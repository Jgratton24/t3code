/**
 * PromptAssembler - Loads templates and substitutes placeholders.
 *
 * Produces per-agent prompts with role directives, scope blocks,
 * history digests, and context injected.
 *
 * @module Discovery/Services/PromptAssembler
 */
import { Effect, ServiceMap } from "effect";
import type { DiscoveryAgentName, DiscoveryPromptMode, DiscoveryScope } from "@t3tools/contracts";
import type { DiscoveryEngineError } from "../Errors";

export interface PromptAssembleInput {
  readonly scope: DiscoveryScope;
  readonly mode: DiscoveryPromptMode;
  readonly context: string;
  readonly history: string;
  readonly agents: readonly DiscoveryAgentName[];
  readonly customPrompt?: string;
  readonly directives?: string;
  readonly parentReport?: string;
}

export interface PromptAssemblerShape {
  /** Assemble per-agent prompts. Returns a map of agent name → prompt text. */
  readonly assemble: (
    input: PromptAssembleInput,
  ) => Effect.Effect<Map<DiscoveryAgentName, string>, DiscoveryEngineError>;
}

export class PromptAssembler extends ServiceMap.Service<PromptAssembler, PromptAssemblerShape>()(
  "t3/discovery/Services/PromptAssembler",
) {}
