/**
 * ContextGatherer - Assembles repository context for discovery prompts.
 *
 * Gathers: directory tree, git diffs, git status, key documentation files.
 *
 * @module Discovery/Services/ContextGatherer
 */
import { Effect, ServiceMap } from "effect";
import type { DiscoveryEngineError } from "../Errors";

export interface ContextGathererShape {
  /** Gather repository context (tree, diffs, docs). */
  readonly gather: () => Effect.Effect<string, DiscoveryEngineError>;
}

export class ContextGatherer extends ServiceMap.Service<ContextGatherer, ContextGathererShape>()(
  "t3/discovery/Services/ContextGatherer",
) {}
