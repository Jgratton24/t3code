/**
 * DiscoveryEngineLive - Full discovery pipeline implementation.
 *
 * Coordinates context gathering, prompt assembly, parallel agent execution,
 * report merging, budget guarding, and persistence via SQLite.
 *
 * @module Discovery/Layers/DiscoveryEngine
 */
import { Effect, Layer, Ref } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import type {
  AgentHealthEntry,
  DiscoveryAgentName,
  DiscoveryAgentReport,
  DiscoveryProjectConfig,
  DiscoveryReport,
  DiscoveryRunConfig,
  DiscoveryRunPhase,
  DiscoveryRunStatus,
  DiscoveryRunSummary,
  DiscoveryScheduleConfig,
  TriageItem,
  TriageUpdateInput,
} from "@t3tools/contracts";
import {
  DiscoveryEngineError,
  DiscoveryNotFoundError,
  type DiscoveryServiceError,
} from "../Errors";
import { DiscoveryEngine, type DiscoveryEngineShape } from "../Services/DiscoveryEngine";
import { ContextGatherer } from "../Services/ContextGatherer";
import { PromptAssembler } from "../Services/PromptAssembler";
import { AgentRunner } from "../Services/AgentRunner";
import { ReportMerger } from "../Services/ReportMerger";
import { HistoryManager } from "../Services/HistoryManager";
import { BudgetGuard } from "../Services/BudgetGuard";

/**
 * In-memory tracking of the currently active run so we can report
 * live status before it hits the DB. Null when no run is executing.
 */
interface ActiveRunState {
  readonly runId: string;
  readonly config: DiscoveryRunConfig;
  readonly phase: DiscoveryRunPhase;
  readonly startedAt: string;
  readonly agents: Array<{
    agent: DiscoveryAgentName;
    status: "pending" | "running" | "succeeded" | "failed" | "timed-out" | "skipped";
    role?: string;
    startedAt?: string;
    completedAt?: string;
    durationSeconds?: number;
    exitCode?: number;
    timedOut?: boolean;
    attempts?: number;
    error?: string;
  }>;
  readonly mergeStatus?: "pending" | "running" | "succeeded" | "failed" | "timed-out" | "skipped";
  readonly error?: string;
}

const makeDiscoveryEngine = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  const contextGatherer = yield* ContextGatherer;
  const promptAssembler = yield* PromptAssembler;
  const agentRunner = yield* AgentRunner;
  const reportMerger = yield* ReportMerger;
  const historyManager = yield* HistoryManager;
  const budgetGuard = yield* BudgetGuard;
  const activeRunRef = yield* Ref.make<ActiveRunState | null>(null);

  // ── Helpers ───────────────────────────────────────────────────────

  const generateRunId = (): string => {
    const now = new Date();
    const pad = (n: number, len = 2) => String(n).padStart(len, "0");
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  };

  const nowIso = () => new Date().toISOString();

  // ── Service Methods ───────────────────────────────────────────────

  const startRun: DiscoveryEngineShape["startRun"] = (config) =>
    Effect.gen(function* () {
      // Ensure no run is already active
      const current = yield* Ref.get(activeRunRef);
      if (current !== null) {
        return yield* new DiscoveryEngineError({
          operation: "startRun",
          detail: `A run is already active: ${current.runId}`,
        });
      }

      const runId = generateRunId();
      const startedAt = nowIso();

      // Initialize active run state
      const initialState: ActiveRunState = {
        runId,
        config,
        phase: "gathering-context",
        startedAt,
        agents: config.agents.map((agent) => ({ agent, status: "pending" as const })),
      };
      yield* Ref.set(activeRunRef, initialState);

      // Persist run record
      yield* sql`
        INSERT INTO discovery_runs (id, scope, mode, phase, config_json, started_at, scheduled, parent_run_id)
        VALUES (${runId}, ${config.scope}, ${config.mode}, ${"gathering-context"}, ${JSON.stringify(config)}, ${startedAt}, ${0}, ${config.parentRunId ?? null})
      `.pipe(
        Effect.mapError(
          (cause) =>
            new DiscoveryEngineError({
              operation: "startRun",
              detail: `Failed to persist run record`,
              cause,
            }),
        ),
      );

      // Fork the pipeline so startRun returns immediately
      yield* Effect.fork(runPipeline(runId, config, startedAt));

      return { runId };
    });

  const runPipeline = (
    runId: string,
    config: DiscoveryRunConfig,
    startedAt: string,
  ): Effect.Effect<void, never> =>
    Effect.gen(function* () {
      // Phase 1: Gather context
      yield* updatePhase(runId, "gathering-context");
      const context = yield* contextGatherer.gather().pipe(
        Effect.mapError(
          (cause) =>
            new DiscoveryEngineError({
              operation: "gatherContext",
              detail: String(cause),
              cause,
            }),
        ),
      );

      // Phase 2: Assemble prompts
      yield* updatePhase(runId, "assembling-prompts");
      const history = config.includeHistory !== false
        ? yield* historyManager.getDigest().pipe(Effect.catchAll(() => Effect.succeed("")))
        : "";
      const prompts = yield* promptAssembler
        .assemble({
          scope: config.scope,
          mode: config.mode,
          context,
          history,
          agents: config.agents,
          customPrompt: config.customPrompt,
          directives: config.directives,
          parentReport: config.parentRunId
            ? yield* getParentReport(config.parentRunId)
            : undefined,
        })
        .pipe(
          Effect.mapError(
            (cause) =>
              new DiscoveryEngineError({
                operation: "assemblePrompts",
                detail: String(cause),
                cause,
              }),
          ),
        );

      // Phase 3: Run agents in parallel
      yield* updatePhase(runId, "running-agents");
      const eligibleAgents = yield* budgetGuard
        .filterEligible(config.agents)
        .pipe(Effect.catchAll(() => Effect.succeed(config.agents)));

      const agentResults = yield* Effect.forEach(
        eligibleAgents,
        (agent) =>
          Effect.gen(function* () {
            yield* updateAgentStatus(runId, agent, "running");
            const prompt = prompts.get(agent) ?? "";
            const result = yield* agentRunner.run(agent, prompt, {
              timeoutSeconds: config.timeoutSeconds,
            }).pipe(
              Effect.tap(() => updateAgentStatus(runId, agent, "succeeded")),
              Effect.tapError((err) =>
                updateAgentStatus(
                  runId,
                  agent,
                  "timedOut" in err && err.timedOut ? "timed-out" : "failed",
                ),
              ),
              Effect.catchAll((err) =>
                Effect.gen(function* () {
                  yield* budgetGuard.checkAndCooldown(agent, String(err)).pipe(
                    Effect.catchAll(() => Effect.void),
                  );
                  return null;
                }),
              ),
            );
            if (result) {
              yield* persistAgentResult(runId, agent, result);
            }
            return result ? { agent, markdown: result.report, role: result.role } : null;
          }),
        { concurrency: "unbounded" },
      );

      const successfulReports = agentResults.filter(
        (r): r is DiscoveryAgentReport => r !== null,
      );

      // Phase 4: Merge reports
      let mergedMarkdown = "";
      if (successfulReports.length === 0) {
        yield* updatePhase(runId, "failed");
        yield* updateRunError(runId, "All agents failed");
        yield* Ref.set(activeRunRef, null);
        return;
      }
      if (successfulReports.length === 1) {
        mergedMarkdown = `> **Note:** Single-source report (${successfulReports[0]!.agent} only). No cross-agent merge performed.\n\n${successfulReports[0]!.markdown}`;
      } else {
        yield* updatePhase(runId, "merging-reports");
        yield* updateMergeStatus(runId, "running");
        const merged = yield* reportMerger
          .merge(successfulReports, config)
          .pipe(
            Effect.tap(() => updateMergeStatus(runId, "succeeded")),
            Effect.tapError(() => updateMergeStatus(runId, "failed")),
            Effect.catchAll(() =>
              Effect.succeed(
                successfulReports.map((r) => `## Report: ${r.agent}\n\n${r.markdown}`).join("\n\n---\n\n"),
              ),
            ),
          );
        mergedMarkdown = merged;
      }

      // Phase 5: Persist report
      const completedAt = nowIso();
      const durationSeconds =
        (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000;

      yield* sql`
        INSERT INTO discovery_reports (run_id, merged_markdown, metadata_json)
        VALUES (${runId}, ${mergedMarkdown}, ${JSON.stringify({
          scope: config.scope,
          mode: config.mode,
          startedAt,
          completedAt,
          durationSeconds,
        })})
      `.pipe(Effect.catchAll(() => Effect.void));

      yield* sql`
        UPDATE discovery_runs
        SET phase = 'completed', completed_at = ${completedAt}, duration_seconds = ${durationSeconds}
        WHERE id = ${runId}
      `.pipe(Effect.catchAll(() => Effect.void));

      // Extract triage items from merged report
      yield* extractAndPersistTriageItems(runId, mergedMarkdown);

      yield* Ref.set(activeRunRef, null);
    }).pipe(
      Effect.catchAll((err) =>
        Effect.gen(function* () {
          yield* sql`
            UPDATE discovery_runs SET phase = 'failed', error = ${String(err)} WHERE id = ${runId}
          `.pipe(Effect.catchAll(() => Effect.void));
          yield* Ref.set(activeRunRef, null);
        }),
      ),
    );

  const updatePhase = (runId: string, phase: DiscoveryRunPhase) =>
    Effect.gen(function* () {
      yield* Ref.update(activeRunRef, (s) => (s && s.runId === runId ? { ...s, phase } : s));
      yield* sql`UPDATE discovery_runs SET phase = ${phase} WHERE id = ${runId}`.pipe(
        Effect.catchAll(() => Effect.void),
      );
    });

  const updateAgentStatus = (
    runId: string,
    agent: DiscoveryAgentName,
    status: "pending" | "running" | "succeeded" | "failed" | "timed-out" | "skipped",
  ) =>
    Ref.update(activeRunRef, (s) => {
      if (!s || s.runId !== runId) return s;
      return {
        ...s,
        agents: s.agents.map((a) => (a.agent === agent ? { ...a, status } : a)),
      };
    });

  const updateMergeStatus = (
    runId: string,
    status: "pending" | "running" | "succeeded" | "failed" | "timed-out" | "skipped",
  ) =>
    Ref.update(activeRunRef, (s) => {
      if (!s || s.runId !== runId) return s;
      return { ...s, mergeStatus: status };
    });

  const updateRunError = (runId: string, error: string) =>
    sql`UPDATE discovery_runs SET error = ${error} WHERE id = ${runId}`.pipe(
      Effect.catchAll(() => Effect.void),
    );

  const persistAgentResult = (
    runId: string,
    agent: DiscoveryAgentName,
    result: { report: string; role?: string; exitCode?: number; durationSeconds?: number },
  ) =>
    sql`
      INSERT INTO discovery_agent_results (run_id, agent, status, role, report_markdown, exit_code, duration_seconds, completed_at)
      VALUES (${runId}, ${agent}, ${"succeeded"}, ${result.role ?? null}, ${result.report}, ${result.exitCode ?? null}, ${result.durationSeconds ?? null}, ${nowIso()})
      ON CONFLICT(run_id, agent) DO UPDATE SET
        status = excluded.status,
        report_markdown = excluded.report_markdown,
        exit_code = excluded.exit_code,
        duration_seconds = excluded.duration_seconds,
        completed_at = excluded.completed_at
    `.pipe(Effect.catchAll(() => Effect.void));

  const extractAndPersistTriageItems = (runId: string, markdown: string) =>
    Effect.gen(function* () {
      // Extract "Open Questions" section from merged report
      const openQuestionsMatch = markdown.match(
        /###\s*Open\s+Questions[^\n]*\n([\s\S]*?)(?=\n###|\n##|$)/i,
      );
      if (!openQuestionsMatch?.[1]) return;

      const lines = openQuestionsMatch[1]
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => /^[-*\d]/.test(l))
        .map((l) => l.replace(/^[-*\d.)\]]+\s*/, "").trim())
        .filter((l) => l.length > 0);

      for (let i = 0; i < lines.length; i++) {
        const id = `${runId}-triage-${i}`;
        yield* sql`
          INSERT OR IGNORE INTO discovery_triage (id, run_id, question_text, status, updated_at)
          VALUES (${id}, ${runId}, ${lines[i]!}, ${"open"}, ${nowIso()})
        `.pipe(Effect.catchAll(() => Effect.void));
      }
    });

  const getParentReport = (parentRunId: string) =>
    Effect.gen(function* () {
      const rows = yield* sql`
        SELECT merged_markdown FROM discovery_reports WHERE run_id = ${parentRunId}
      `.pipe(
        Effect.mapError(
          () =>
            new DiscoveryNotFoundError({ entity: "report", id: parentRunId }),
        ),
      );
      const row = rows[0] as { merged_markdown: string } | undefined;
      return row?.merged_markdown;
    });

  const cancelRun: DiscoveryEngineShape["cancelRun"] = (runId) =>
    Effect.gen(function* () {
      const current = yield* Ref.get(activeRunRef);
      if (!current || current.runId !== runId) {
        return yield* new DiscoveryNotFoundError({ entity: "active run", id: runId });
      }
      yield* sql`
        UPDATE discovery_runs SET phase = 'cancelled', completed_at = ${nowIso()} WHERE id = ${runId}
      `.pipe(Effect.catchAll(() => Effect.void));
      yield* Ref.set(activeRunRef, null);
    });

  const getRunStatus: DiscoveryEngineShape["getRunStatus"] = (runId) =>
    Effect.gen(function* () {
      // Check active run first
      const active = yield* Ref.get(activeRunRef);
      if (active && active.runId === runId) {
        const elapsed =
          (Date.now() - new Date(active.startedAt).getTime()) / 1000;
        return {
          runId: runId as any,
          phase: active.phase,
          scope: active.config.scope,
          mode: active.config.mode,
          agents: active.agents as any,
          mergeStatus: active.mergeStatus,
          startedAt: active.startedAt,
          elapsedSeconds: Math.round(elapsed),
        } satisfies DiscoveryRunStatus;
      }

      // Fall back to DB
      const rows = yield* sql`SELECT * FROM discovery_runs WHERE id = ${runId}`.pipe(
        Effect.mapError(
          () => new DiscoveryNotFoundError({ entity: "run", id: runId }),
        ),
      );
      const run = rows[0] as any;
      if (!run) {
        return yield* new DiscoveryNotFoundError({ entity: "run", id: runId });
      }

      const agentRows = yield* sql`
        SELECT * FROM discovery_agent_results WHERE run_id = ${runId}
      `.pipe(Effect.catchAll(() => Effect.succeed([])));

      return {
        runId: run.id,
        phase: run.phase,
        scope: run.scope,
        mode: run.mode,
        agents: (agentRows as any[]).map((a: any) => ({
          agent: a.agent,
          status: a.status,
          role: a.role,
          durationSeconds: a.duration_seconds,
          exitCode: a.exit_code,
        })),
        startedAt: run.started_at,
        elapsedSeconds: run.duration_seconds,
        error: run.error,
      } satisfies DiscoveryRunStatus;
    });

  const listRuns: DiscoveryEngineShape["listRuns"] = (input) =>
    Effect.gen(function* () {
      const limit = input.limit ?? 20;
      const offset = input.offset ?? 0;

      const rows = yield* sql`
        SELECT r.*,
          (SELECT COUNT(*) FROM discovery_agent_results WHERE run_id = r.id AND status = 'succeeded') as agents_succeeded,
          (SELECT COUNT(*) FROM discovery_agent_results WHERE run_id = r.id AND status = 'failed') as agents_failed,
          (SELECT COUNT(*) FROM discovery_agent_results WHERE run_id = r.id AND status = 'timed-out') as agents_timed_out,
          (SELECT COUNT(*) FROM discovery_triage WHERE run_id = r.id AND status = 'open') as triage_open,
          (SELECT COUNT(*) FROM discovery_triage WHERE run_id = r.id) as triage_total
        FROM discovery_runs r
        ORDER BY r.started_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `.pipe(
        Effect.mapError(
          (cause) =>
            new DiscoveryEngineError({
              operation: "listRuns",
              detail: "Failed to query runs",
              cause,
            }),
        ),
      );

      return (rows as any[]).map((r: any) => ({
        runId: r.id,
        scope: r.scope,
        mode: r.mode,
        phase: r.phase,
        startedAt: r.started_at,
        completedAt: r.completed_at,
        durationSeconds: r.duration_seconds,
        agentsSucceeded: r.agents_succeeded ?? 0,
        agentsFailed: r.agents_failed ?? 0,
        agentsTimedOut: r.agents_timed_out ?? 0,
        triageOpen: r.triage_open ?? 0,
        triageTotal: r.triage_total ?? 0,
        scheduled: Boolean(r.scheduled),
        parentRunId: r.parent_run_id,
        error: r.error,
      })) satisfies DiscoveryRunSummary[];
    });

  const getReport: DiscoveryEngineShape["getReport"] = (runId) =>
    Effect.gen(function* () {
      const reportRows = yield* sql`
        SELECT * FROM discovery_reports WHERE run_id = ${runId}
      `.pipe(
        Effect.mapError(
          () => new DiscoveryNotFoundError({ entity: "report", id: runId }),
        ),
      );
      const report = (reportRows as any[])[0] as any;
      if (!report) {
        return yield* new DiscoveryNotFoundError({ entity: "report", id: runId });
      }

      const agentRows = yield* sql`
        SELECT * FROM discovery_agent_results WHERE run_id = ${runId}
      `.pipe(Effect.catchAll(() => Effect.succeed([])));

      const metadata = JSON.parse(report.metadata_json);

      return {
        runId: runId as any,
        mergedMarkdown: report.merged_markdown,
        agentReports: (agentRows as any[])
          .filter((a: any) => a.report_markdown)
          .map((a: any) => ({
            agent: a.agent,
            markdown: a.report_markdown,
            role: a.role,
            durationSeconds: a.duration_seconds,
          })),
        docSuggestions: report.doc_suggestions,
        metadata,
      } satisfies DiscoveryReport;
    });

  const getAgentHealth: DiscoveryEngineShape["getAgentHealth"] = () =>
    Effect.gen(function* () {
      const rows = yield* sql`SELECT * FROM discovery_agent_health`.pipe(
        Effect.catchAll(() => Effect.succeed([])),
      );

      const agents: DiscoveryAgentName[] = ["codex", "claude"];
      const healthMap = new Map(
        (rows as any[]).map((r: any) => [r.agent, r]),
      );

      return agents.map((agent) => {
        const row = healthMap.get(agent) as any;
        if (!row) {
          return {
            agent,
            status: "healthy" as const,
            lastFiveResults: [],
          };
        }
        const isOnCooldown =
          row.cooldown_until && new Date(row.cooldown_until) > new Date();
        return {
          agent,
          status: isOnCooldown ? ("cooldown" as const) : ("healthy" as const),
          cooldownUntil: row.cooldown_until,
          cooldownReason: row.cooldown_reason,
          lastSeenAt: row.last_seen_at,
          lastFiveResults: [],
        };
      }) satisfies AgentHealthEntry[];
    });

  const resetAgentCooldown: DiscoveryEngineShape["resetAgentCooldown"] = (agent) =>
    sql`
      UPDATE discovery_agent_health
      SET status = 'healthy', cooldown_until = NULL, cooldown_reason = NULL
      WHERE agent = ${agent}
    `.pipe(
      Effect.asVoid,
      Effect.mapError(
        (cause) =>
          new DiscoveryEngineError({
            operation: "resetAgentCooldown",
            detail: `Failed to reset cooldown for ${agent}`,
            cause,
          }),
      ),
    );

  const getSchedule: DiscoveryEngineShape["getSchedule"] = () =>
    Effect.gen(function* () {
      const rows = yield* sql`SELECT * FROM discovery_schedule WHERE id = 1`.pipe(
        Effect.catchAll(() => Effect.succeed([])),
      );
      const row = (rows as any[])[0] as any;
      if (!row) {
        return {
          enabled: false,
          scopeRotation: ["full" as const],
          fullAuditEveryN: 7,
        } satisfies DiscoveryScheduleConfig;
      }
      return {
        enabled: Boolean(row.enabled),
        cronExpression: row.cron_expression,
        scopeRotation: JSON.parse(row.scope_rotation_json),
        fullAuditEveryN: row.full_audit_every_n,
        focus: row.focus,
        nextRunAt: row.next_run_at,
      } satisfies DiscoveryScheduleConfig;
    });

  const updateSchedule: DiscoveryEngineShape["updateSchedule"] = (config) =>
    sql`
      INSERT INTO discovery_schedule (id, enabled, cron_expression, scope_rotation_json, full_audit_every_n, focus, next_run_at, updated_at)
      VALUES (1, ${config.enabled ? 1 : 0}, ${config.cronExpression ?? null}, ${JSON.stringify(config.scopeRotation)}, ${config.fullAuditEveryN}, ${config.focus ?? null}, ${config.nextRunAt ?? null}, ${nowIso()})
      ON CONFLICT(id) DO UPDATE SET
        enabled = excluded.enabled,
        cron_expression = excluded.cron_expression,
        scope_rotation_json = excluded.scope_rotation_json,
        full_audit_every_n = excluded.full_audit_every_n,
        focus = excluded.focus,
        next_run_at = excluded.next_run_at,
        updated_at = excluded.updated_at
    `.pipe(
      Effect.asVoid,
      Effect.mapError(
        (cause) =>
          new DiscoveryEngineError({
            operation: "updateSchedule",
            detail: "Failed to update schedule",
            cause,
          }),
      ),
    );

  const triageUpdate: DiscoveryEngineShape["triageUpdate"] = (input) =>
    sql`
      UPDATE discovery_triage
      SET status = ${input.status}, note = ${input.note ?? null}, updated_at = ${nowIso()}
      WHERE id = ${input.id} AND run_id = ${input.runId}
    `.pipe(
      Effect.asVoid,
      Effect.mapError(
        (cause) =>
          new DiscoveryEngineError({
            operation: "triageUpdate",
            detail: `Failed to update triage item ${input.id}`,
            cause,
          }),
      ),
    );

  const triageList: DiscoveryEngineShape["triageList"] = (runId) =>
    Effect.gen(function* () {
      const rows = yield* sql`
        SELECT * FROM discovery_triage WHERE run_id = ${runId} ORDER BY updated_at DESC
      `.pipe(
        Effect.mapError(
          (cause) =>
            new DiscoveryEngineError({
              operation: "triageList",
              detail: "Failed to query triage items",
              cause,
            }),
        ),
      );
      return (rows as any[]).map((r: any) => ({
        id: r.id,
        runId: r.run_id,
        questionText: r.question_text,
        status: r.status,
        note: r.note,
        updatedAt: r.updated_at,
      })) satisfies TriageItem[];
    });

  const getConfig: DiscoveryEngineShape["getConfig"] = () =>
    Effect.gen(function* () {
      const rows = yield* sql`SELECT * FROM discovery_config WHERE id = 1`.pipe(
        Effect.catchAll(() => Effect.succeed([])),
      );
      const row = (rows as any[])[0] as any;
      if (!row) {
        return {
          agents: ["codex", "claude"] as const,
          defaultScope: "full" as const,
          defaultTimeoutSeconds: 600,
          cooldownHours: 6,
          maxHistoryRuns: 3,
          maxHistoryItemsPerRun: 5,
        } satisfies DiscoveryProjectConfig;
      }
      return {
        agents: JSON.parse(row.agents_json),
        defaultScope: row.default_scope,
        defaultTimeoutSeconds: row.default_timeout_seconds,
        mergeAgent: row.merge_agent,
        cooldownHours: row.cooldown_hours,
        maxHistoryRuns: row.max_history_runs,
        maxHistoryItemsPerRun: row.max_history_items_per_run,
      } satisfies DiscoveryProjectConfig;
    });

  const updateConfig: DiscoveryEngineShape["updateConfig"] = (config) =>
    sql`
      INSERT INTO discovery_config (id, agents_json, default_scope, default_timeout_seconds, merge_agent, cooldown_hours, max_history_runs, max_history_items_per_run, updated_at)
      VALUES (1, ${JSON.stringify(config.agents)}, ${config.defaultScope}, ${config.defaultTimeoutSeconds}, ${config.mergeAgent ?? null}, ${config.cooldownHours}, ${config.maxHistoryRuns}, ${config.maxHistoryItemsPerRun}, ${nowIso()})
      ON CONFLICT(id) DO UPDATE SET
        agents_json = excluded.agents_json,
        default_scope = excluded.default_scope,
        default_timeout_seconds = excluded.default_timeout_seconds,
        merge_agent = excluded.merge_agent,
        cooldown_hours = excluded.cooldown_hours,
        max_history_runs = excluded.max_history_runs,
        max_history_items_per_run = excluded.max_history_items_per_run,
        updated_at = excluded.updated_at
    `.pipe(
      Effect.asVoid,
      Effect.mapError(
        (cause) =>
          new DiscoveryEngineError({
            operation: "updateConfig",
            detail: "Failed to update config",
            cause,
          }),
      ),
    );

  return {
    startRun,
    cancelRun,
    getRunStatus,
    listRuns,
    getReport,
    getAgentHealth,
    resetAgentCooldown,
    getSchedule,
    updateSchedule,
    triageUpdate,
    triageList,
    getConfig,
    updateConfig,
  } satisfies DiscoveryEngineShape;
});

export const DiscoveryEngineLive = Layer.effect(DiscoveryEngine, makeDiscoveryEngine);
