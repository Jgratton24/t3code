/**
 * AgentRunnerLive - Spawns CLI agent processes for discovery.
 *
 * Uses processRunner to execute codex/claude CLI tools, captures their
 * output as discovery reports.
 *
 * @module Discovery/Layers/AgentRunner
 */
import { Effect, Layer } from "effect";
import type { AgentRunResult, AgentRunnerShape } from "../Services/AgentRunner";
import { AgentRunner } from "../Services/AgentRunner";
import { DiscoveryAgentError } from "../Errors";
import { ServerConfig } from "../../config";
import { runProcess } from "../../processRunner";

/** Agent CLI configurations matching the existing .ai/config.json patterns */
const AGENT_CONFIGS: Record<
  string,
  {
    command: string;
    args: readonly string[];
    defaultTimeoutSeconds: number;
    role: string;
  }
> = {
  codex: {
    command: "codex",
    args: ["exec", "--sandbox", "full-auto", "--quiet"],
    defaultTimeoutSeconds: 900,
    role: "breadth",
  },
  claude: {
    command: "claude",
    args: ["--print"],
    defaultTimeoutSeconds: 600,
    role: "depth",
  },
};

const makeAgentRunner = Effect.gen(function* () {
  const { cwd } = yield* ServerConfig;

  const run: AgentRunnerShape["run"] = (agent, prompt, options) =>
    Effect.gen(function* () {
      const config = AGENT_CONFIGS[agent];
      if (!config) {
        return yield* new DiscoveryAgentError({
          agent,
          operation: "run",
          detail: `Unknown agent: ${agent}`,
        });
      }

      const timeoutSeconds = options?.timeoutSeconds ?? config.defaultTimeoutSeconds;
      const startTime = Date.now();

      const result = yield* Effect.tryPromise({
        try: () =>
          runProcess(config.command, [...config.args], {
            cwd,
            stdin: prompt,
            timeoutMs: timeoutSeconds * 1000,
            allowNonZeroExit: true,
            outputMode: "truncate",
            maxBufferBytes: 4 * 1024 * 1024, // 4MB max output
          }),
        catch: (cause) =>
          new DiscoveryAgentError({
            agent,
            operation: "run",
            detail: cause instanceof Error ? cause.message : `Failed to spawn ${agent}`,
            cause,
          }),
      });

      const durationSeconds = (Date.now() - startTime) / 1000;

      if (result.timedOut) {
        return yield* new DiscoveryAgentError({
          agent,
          operation: "run",
          detail: `Agent timed out after ${timeoutSeconds}s`,
          timedOut: true,
        });
      }

      if (result.code !== 0 && result.code !== null) {
        return yield* new DiscoveryAgentError({
          agent,
          operation: "run",
          detail: result.stderr.trim() || `Exited with code ${result.code}`,
          exitCode: result.code,
        });
      }

      const report = result.stdout.trim();
      if (report.length === 0) {
        return yield* new DiscoveryAgentError({
          agent,
          operation: "run",
          detail: "Agent produced empty output",
        });
      }

      return {
        report,
        role: config.role,
        exitCode: result.code ?? 0,
        durationSeconds: Math.round(durationSeconds),
        logText: result.stderr,
      } satisfies AgentRunResult;
    });

  return { run } satisfies AgentRunnerShape;
});

export const AgentRunnerLive = Layer.effect(AgentRunner, makeAgentRunner);
