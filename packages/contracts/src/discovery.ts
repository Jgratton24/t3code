/**
 * Discovery - AI Discovery feature contract schemas.
 *
 * Defines all shared types for the discovery pipeline: run configuration,
 * agent execution, report merging, triage, scheduling, and health monitoring.
 *
 * Schema-only - no runtime logic per package rules.
 *
 * @module Discovery
 */
import { Schema } from "effect";
import { IsoDateTime, TrimmedNonEmptyString } from "./baseSchemas";

// ── Branded IDs ─────────────────────────────────────────────────────

const makeEntityId = <Brand extends string>(brand: Brand) =>
  TrimmedNonEmptyString.pipe(Schema.brand(brand));

export const DiscoveryRunId = makeEntityId("DiscoveryRunId");
export type DiscoveryRunId = typeof DiscoveryRunId.Type;

export const TriageItemId = makeEntityId("TriageItemId");
export type TriageItemId = typeof TriageItemId.Type;

// ── Literal Unions ──────────────────────────────────────────────────

export const DiscoveryAgentName = Schema.Literals(["codex", "claude"]);
export type DiscoveryAgentName = typeof DiscoveryAgentName.Type;

export const DiscoveryScope = Schema.Literals([
  "full",
  "product",
  "techdebt",
  "guided-intelligence",
]);
export type DiscoveryScope = typeof DiscoveryScope.Type;

export const DiscoveryPromptMode = Schema.Literals(["discovery", "custom", "refine"]);
export type DiscoveryPromptMode = typeof DiscoveryPromptMode.Type;

export const DiscoveryRunPhase = Schema.Literals([
  "gathering-context",
  "assembling-prompts",
  "running-agents",
  "merging-reports",
  "completed",
  "failed",
  "cancelled",
]);
export type DiscoveryRunPhase = typeof DiscoveryRunPhase.Type;

export const AgentRunStatus = Schema.Literals([
  "pending",
  "running",
  "succeeded",
  "failed",
  "timed-out",
  "skipped",
]);
export type AgentRunStatus = typeof AgentRunStatus.Type;

export const TriageStatus = Schema.Literals(["open", "filed", "integrated", "dismissed"]);
export type TriageStatus = typeof TriageStatus.Type;

export const DiffMode = Schema.Literals(["working", "branch"]);
export type DiffMode = typeof DiffMode.Type;

// ── Run Configuration (client → server) ─────────────────────────────

export const DiscoveryRunConfig = Schema.Struct({
  scope: DiscoveryScope,
  agents: Schema.Array(DiscoveryAgentName),
  mode: DiscoveryPromptMode,

  /** Custom prompt text (when mode = "custom") */
  customPrompt: Schema.optional(Schema.String),

  /** Parent run ID for refinement (when mode = "refine") */
  parentRunId: Schema.optional(DiscoveryRunId),

  /** Refinement directives text (when mode = "refine") */
  directives: Schema.optional(Schema.String),

  /** Override diff mode */
  diffMode: Schema.optional(DiffMode),

  /** Include directory tree in context */
  includeTree: Schema.optional(Schema.Boolean),

  /** Include git diffs in context */
  includeDiff: Schema.optional(Schema.Boolean),

  /** Include history from previous runs */
  includeHistory: Schema.optional(Schema.Boolean),

  /** Enable merge of multi-agent reports */
  enableMerge: Schema.optional(Schema.Boolean),

  /** Timeout override in seconds */
  timeoutSeconds: Schema.optional(Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0)))),

  /** Calibration mode (force all agents to same role) */
  calibrationRole: Schema.optional(Schema.Literals(["breadth", "depth"])),

  /** Focus text for the run */
  focus: Schema.optional(Schema.String),
});
export type DiscoveryRunConfig = typeof DiscoveryRunConfig.Type;

// ── Agent Status (per-agent within a run) ───────────────────────────

export const DiscoveryAgentStatus = Schema.Struct({
  agent: DiscoveryAgentName,
  status: AgentRunStatus,
  role: Schema.optional(Schema.String),
  startedAt: Schema.optional(IsoDateTime),
  completedAt: Schema.optional(IsoDateTime),
  durationSeconds: Schema.optional(Schema.Number),
  exitCode: Schema.optional(Schema.Int),
  timedOut: Schema.optional(Schema.Boolean),
  attempts: Schema.optional(Schema.Int),
  error: Schema.optional(Schema.String),
});
export type DiscoveryAgentStatus = typeof DiscoveryAgentStatus.Type;

// ── Run Status (pushed via WebSocket) ───────────────────────────────

export const DiscoveryRunStatus = Schema.Struct({
  runId: DiscoveryRunId,
  phase: DiscoveryRunPhase,
  scope: DiscoveryScope,
  mode: DiscoveryPromptMode,
  agents: Schema.Array(DiscoveryAgentStatus),
  mergeStatus: Schema.optional(AgentRunStatus),
  startedAt: IsoDateTime,
  elapsedSeconds: Schema.optional(Schema.Number),
  error: Schema.optional(Schema.String),
});
export type DiscoveryRunStatus = typeof DiscoveryRunStatus.Type;

// ── Run Summary (persisted, for history list) ───────────────────────

export const DiscoveryRunSummary = Schema.Struct({
  runId: DiscoveryRunId,
  scope: DiscoveryScope,
  mode: DiscoveryPromptMode,
  phase: DiscoveryRunPhase,
  startedAt: IsoDateTime,
  completedAt: Schema.optional(IsoDateTime),
  durationSeconds: Schema.optional(Schema.Number),
  agentsSucceeded: Schema.Int,
  agentsFailed: Schema.Int,
  agentsTimedOut: Schema.Int,
  triageOpen: Schema.Int,
  triageTotal: Schema.Int,
  scheduled: Schema.Boolean,
  parentRunId: Schema.optional(DiscoveryRunId),
  error: Schema.optional(Schema.String),
});
export type DiscoveryRunSummary = typeof DiscoveryRunSummary.Type;

// ── Report Content ──────────────────────────────────────────────────

export const DiscoveryAgentReport = Schema.Struct({
  agent: DiscoveryAgentName,
  markdown: Schema.String,
  role: Schema.optional(Schema.String),
  durationSeconds: Schema.optional(Schema.Number),
});
export type DiscoveryAgentReport = typeof DiscoveryAgentReport.Type;

export const DiscoveryReport = Schema.Struct({
  runId: DiscoveryRunId,
  mergedMarkdown: Schema.String,
  agentReports: Schema.Array(DiscoveryAgentReport),
  docSuggestions: Schema.optional(Schema.String),
  metadata: Schema.Struct({
    scope: DiscoveryScope,
    mode: DiscoveryPromptMode,
    startedAt: IsoDateTime,
    completedAt: IsoDateTime,
    durationSeconds: Schema.Number,
    promptBytes: Schema.optional(Schema.Int),
    historyRunsReferenced: Schema.optional(Schema.Int),
    parentRunId: Schema.optional(DiscoveryRunId),
  }),
});
export type DiscoveryReport = typeof DiscoveryReport.Type;

// ── Agent Health ────────────────────────────────────────────────────

export const AgentHealthEntry = Schema.Struct({
  agent: DiscoveryAgentName,
  status: Schema.Literals(["healthy", "cooldown", "unavailable"]),
  cooldownUntil: Schema.optional(IsoDateTime),
  cooldownReason: Schema.optional(Schema.String),
  lastSeenAt: Schema.optional(IsoDateTime),
  lastFiveResults: Schema.Array(AgentRunStatus),
});
export type AgentHealthEntry = typeof AgentHealthEntry.Type;

// ── Triage ──────────────────────────────────────────────────────────

export const TriageItem = Schema.Struct({
  id: TriageItemId,
  runId: DiscoveryRunId,
  questionText: Schema.String,
  status: TriageStatus,
  note: Schema.optional(Schema.String),
  updatedAt: IsoDateTime,
});
export type TriageItem = typeof TriageItem.Type;

export const TriageUpdateInput = Schema.Struct({
  id: TriageItemId,
  runId: DiscoveryRunId,
  status: TriageStatus,
  note: Schema.optional(Schema.String),
});
export type TriageUpdateInput = typeof TriageUpdateInput.Type;

// ── Schedule Configuration ──────────────────────────────────────────

export const DiscoveryScheduleConfig = Schema.Struct({
  enabled: Schema.Boolean,
  /** Cron expression (e.g. "0 22 * * *") */
  cronExpression: Schema.optional(Schema.String),
  /** Days of week (0=Sun, 6=Sat) */
  daysOfWeek: Schema.optional(Schema.Array(Schema.Int)),
  /** Hour of day (0-23) */
  hour: Schema.optional(Schema.Int),
  /** Minute (0-59) */
  minute: Schema.optional(Schema.Int),
  /** Scope rotation list */
  scopeRotation: Schema.Array(DiscoveryScope).pipe(
    Schema.withDecodingDefault(() => ["full" as const]),
  ),
  /** Run full audit every N rotations */
  fullAuditEveryN: Schema.Int.pipe(Schema.withDecodingDefault(() => 7)),
  /** One-shot focus text for next scheduled run */
  focus: Schema.optional(Schema.String),
  /** Next scheduled run preview */
  nextRunAt: Schema.optional(IsoDateTime),
});
export type DiscoveryScheduleConfig = typeof DiscoveryScheduleConfig.Type;

// ── Per-Project Discovery Config ────────────────────────────────────

export const DiscoveryProjectConfig = Schema.Struct({
  /** Agents available for this project */
  agents: Schema.Array(DiscoveryAgentName).pipe(
    Schema.withDecodingDefault(() => ["codex", "claude"] as const),
  ),
  /** Default scope */
  defaultScope: DiscoveryScope.pipe(Schema.withDecodingDefault(() => "full" as const)),
  /** Default timeout per agent (seconds) */
  defaultTimeoutSeconds: Schema.Int.pipe(Schema.withDecodingDefault(() => 600)),
  /** Merge agent preference */
  mergeAgent: Schema.optional(DiscoveryAgentName),
  /** Cooldown hours on budget guard trigger */
  cooldownHours: Schema.Int.pipe(Schema.withDecodingDefault(() => 6)),
  /** Max history runs to reference */
  maxHistoryRuns: Schema.Int.pipe(Schema.withDecodingDefault(() => 3)),
  /** Max items per history run */
  maxHistoryItemsPerRun: Schema.Int.pipe(Schema.withDecodingDefault(() => 5)),
});
export type DiscoveryProjectConfig = typeof DiscoveryProjectConfig.Type;

// ── WebSocket Input Schemas ─────────────────────────────────────────

export const DiscoveryStartRunInput = Schema.Struct({
  config: DiscoveryRunConfig,
});
export type DiscoveryStartRunInput = typeof DiscoveryStartRunInput.Type;

export const DiscoveryCancelRunInput = Schema.Struct({
  runId: DiscoveryRunId,
});
export type DiscoveryCancelRunInput = typeof DiscoveryCancelRunInput.Type;

export const DiscoveryGetRunStatusInput = Schema.Struct({
  runId: DiscoveryRunId,
});
export type DiscoveryGetRunStatusInput = typeof DiscoveryGetRunStatusInput.Type;

export const DiscoveryListRunsInput = Schema.Struct({
  limit: Schema.optional(Schema.Int.pipe(Schema.check(Schema.isGreaterThan(0)))),
  offset: Schema.optional(Schema.Int.pipe(Schema.check(Schema.isGreaterThanOrEqualTo(0)))),
});
export type DiscoveryListRunsInput = typeof DiscoveryListRunsInput.Type;

export const DiscoveryGetReportInput = Schema.Struct({
  runId: DiscoveryRunId,
});
export type DiscoveryGetReportInput = typeof DiscoveryGetReportInput.Type;

export const DiscoveryResetAgentCooldownInput = Schema.Struct({
  agent: DiscoveryAgentName,
});
export type DiscoveryResetAgentCooldownInput = typeof DiscoveryResetAgentCooldownInput.Type;

export const DiscoveryTriageListInput = Schema.Struct({
  runId: DiscoveryRunId,
});
export type DiscoveryTriageListInput = typeof DiscoveryTriageListInput.Type;

// ── Discovery WS Method Names ───────────────────────────────────────

export const DISCOVERY_WS_METHODS = {
  startRun: "discovery.startRun",
  cancelRun: "discovery.cancelRun",
  getRunStatus: "discovery.getRunStatus",
  listRuns: "discovery.listRuns",
  getReport: "discovery.getReport",
  getAgentHealth: "discovery.getAgentHealth",
  resetAgentCooldown: "discovery.resetAgentCooldown",
  getSchedule: "discovery.getSchedule",
  updateSchedule: "discovery.updateSchedule",
  triageUpdate: "discovery.triageUpdate",
  triageList: "discovery.triageList",
  getConfig: "discovery.getConfig",
  updateConfig: "discovery.updateConfig",
} as const;

// ── Discovery WS Push Channels ──────────────────────────────────────

export const DISCOVERY_WS_CHANNELS = {
  runProgress: "discovery.runProgress",
  runCompleted: "discovery.runCompleted",
  agentHealthChanged: "discovery.agentHealthChanged",
  agentLogChunk: "discovery.agentLogChunk",
} as const;
