/**
 * HistoryManager - Cross-run dedup digest extraction.
 *
 * Extracts top opportunities and open questions from previous
 * runs to avoid re-reporting unchanged findings.
 *
 * @module Discovery/Services/HistoryManager
 */
import { Effect, ServiceMap } from "effect";
import type { DiscoveryEngineError } from "../Errors";

export interface HistoryManagerShape {
  /** Get a dedup digest from recent runs. */
  readonly getDigest: () => Effect.Effect<string, DiscoveryEngineError>;
}

export class HistoryManager extends ServiceMap.Service<HistoryManager, HistoryManagerShape>()(
  "t3/discovery/Services/HistoryManager",
) {}
