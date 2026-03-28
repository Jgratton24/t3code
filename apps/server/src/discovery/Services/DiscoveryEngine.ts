/**
 * DiscoveryEngine - Top-level discovery pipeline orchestrator.
 *
 * Coordinates: context gathering -> prompt assembly -> agent execution ->
 * report merging -> persistence. Exposes the full discovery API surface
 * consumed by the WebSocket route handler.
 *
 * @module Discovery/Services/DiscoveryEngine
 */
import { Effect, ServiceMap } from "effect";
import type {
  AgentHealthEntry,
  DiscoveryProjectConfig,
  DiscoveryReport,
  DiscoveryRunConfig,
  DiscoveryRunStatus,
  DiscoveryRunSummary,
  DiscoveryScheduleConfig,
  TriageItem,
  TriageUpdateInput,
} from "@t3tools/contracts";
import type { DiscoveryServiceError } from "../Errors";

export interface DiscoveryEngineShape {
  /** Start a new discovery run. Returns the run ID. */
  readonly startRun: (
    config: DiscoveryRunConfig,
  ) => Effect.Effect<{ runId: string }, DiscoveryServiceError>;

  /** Cancel an active discovery run. */
  readonly cancelRun: (runId: string) => Effect.Effect<void, DiscoveryServiceError>;

  /** Get the current status of a run. */
  readonly getRunStatus: (
    runId: string,
  ) => Effect.Effect<DiscoveryRunStatus, DiscoveryServiceError>;

  /** List run summaries (paginated, newest first). */
  readonly listRuns: (input: {
    limit?: number;
    offset?: number;
  }) => Effect.Effect<DiscoveryRunSummary[], DiscoveryServiceError>;

  /** Get the full report for a completed run. */
  readonly getReport: (runId: string) => Effect.Effect<DiscoveryReport, DiscoveryServiceError>;

  /** Get agent health status for all agents. */
  readonly getAgentHealth: () => Effect.Effect<AgentHealthEntry[], DiscoveryServiceError>;

  /** Reset cooldown for a specific agent. */
  readonly resetAgentCooldown: (agent: string) => Effect.Effect<void, DiscoveryServiceError>;

  /** Get the current schedule configuration. */
  readonly getSchedule: () => Effect.Effect<DiscoveryScheduleConfig, DiscoveryServiceError>;

  /** Update the schedule configuration. */
  readonly updateSchedule: (
    config: DiscoveryScheduleConfig,
  ) => Effect.Effect<void, DiscoveryServiceError>;

  /** Update triage status for an open question. */
  readonly triageUpdate: (input: TriageUpdateInput) => Effect.Effect<void, DiscoveryServiceError>;

  /** List triage items for a run. */
  readonly triageList: (runId: string) => Effect.Effect<TriageItem[], DiscoveryServiceError>;

  /** Get discovery project config. */
  readonly getConfig: () => Effect.Effect<DiscoveryProjectConfig, DiscoveryServiceError>;

  /** Update discovery project config. */
  readonly updateConfig: (
    config: DiscoveryProjectConfig,
  ) => Effect.Effect<void, DiscoveryServiceError>;
}

export class DiscoveryEngine extends ServiceMap.Service<DiscoveryEngine, DiscoveryEngineShape>()(
  "t3/discovery/Services/DiscoveryEngine",
) {}
