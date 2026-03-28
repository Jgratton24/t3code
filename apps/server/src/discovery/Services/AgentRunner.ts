/**
 * AgentRunner - Spawns CLI agent processes and captures output.
 *
 * Wraps processRunner with streaming log output for live progress viewing.
 *
 * @module Discovery/Services/AgentRunner
 */
import { Effect, ServiceMap } from "effect";
import type { DiscoveryAgentName } from "@t3tools/contracts";
import type { DiscoveryAgentError } from "../Errors";

export interface AgentRunResult {
  readonly report: string;
  readonly role?: string;
  readonly exitCode?: number;
  readonly durationSeconds?: number;
  readonly logText?: string;
}

export interface AgentRunOptions {
  readonly timeoutSeconds?: number;
}

export interface AgentRunnerShape {
  /** Run a discovery agent with the given prompt. */
  readonly run: (
    agent: DiscoveryAgentName,
    prompt: string,
    options?: AgentRunOptions,
  ) => Effect.Effect<AgentRunResult, DiscoveryAgentError>;
}

export class AgentRunner extends ServiceMap.Service<AgentRunner, AgentRunnerShape>()(
  "t3/discovery/Services/AgentRunner",
) {}
