/**
 * ReportMerger - Synthesizes multiple agent reports via merge agent.
 *
 * @module Discovery/Services/ReportMerger
 */
import { Effect, ServiceMap } from "effect";
import type { DiscoveryAgentReport, DiscoveryRunConfig } from "@t3tools/contracts";
import type { DiscoveryAgentError } from "../Errors";

export interface ReportMergerShape {
  /** Merge multiple agent reports into a single synthesized report. */
  readonly merge: (
    reports: readonly DiscoveryAgentReport[],
    config: DiscoveryRunConfig,
  ) => Effect.Effect<string, DiscoveryAgentError>;
}

export class ReportMerger extends ServiceMap.Service<ReportMerger, ReportMergerShape>()(
  "t3/discovery/Services/ReportMerger",
) {}
