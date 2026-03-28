/**
 * ReportMergerLive - Synthesizes multiple agent reports via merge agent.
 *
 * Spawns a merge agent (Claude by default) to deduplicate insights,
 * resolve conflicts, and produce a ranked opportunity backlog.
 *
 * @module Discovery/Layers/ReportMerger
 */
import { Effect, Layer } from "effect";
import type { DiscoveryAgentReport } from "@t3tools/contracts";
import type { ReportMergerShape } from "../Services/ReportMerger";
import { ReportMerger } from "../Services/ReportMerger";
import { DiscoveryAgentError } from "../Errors";
import { ServerConfig } from "../../config";
import { runProcess } from "../../processRunner";

const MERGE_PROMPT_HEADER = `You are a senior engineering advisor synthesizing discovery reports from multiple AI agents.

**Instructions:**
- Deduplicate same insights (cite both agents).
- Resolve conflicts by noting both perspectives and recommending the stronger position.
- Rank all opportunities by Impact (high/medium/low), Effort, and Risk.
- Preserve the output format exactly.

## Reports to Merge

`;

const makeReportMerger = Effect.gen(function* () {
  const { cwd } = yield* ServerConfig;

  const merge: ReportMergerShape["merge"] = (reports, _config) =>
    Effect.gen(function* () {
      // Build the merge prompt
      const reportSections = reports
        .map((r: DiscoveryAgentReport) => `## Report: ${r.agent} (${r.role ?? "unknown role"})\n\n${r.markdown}`)
        .join("\n\n---\n\n");

      const mergePrompt = `${MERGE_PROMPT_HEADER}${reportSections}`;

      // Use Claude CLI as the merge agent (matching existing .ai/config.json preference)
      const result = yield* Effect.tryPromise({
        try: () =>
          runProcess("claude", ["--print"], {
            cwd,
            stdin: mergePrompt,
            timeoutMs: 600_000, // 10 minutes for merge
            allowNonZeroExit: true,
            outputMode: "truncate",
            maxBufferBytes: 4 * 1024 * 1024,
          }),
        catch: (cause) =>
          new DiscoveryAgentError({
            agent: "claude",
            operation: "merge",
            detail: cause instanceof Error ? cause.message : "Failed to spawn merge agent",
            cause,
          }),
      });

      if (result.timedOut) {
        return yield* new DiscoveryAgentError({
          agent: "claude",
          operation: "merge",
          detail: "Merge agent timed out",
          timedOut: true,
        });
      }

      const merged = result.stdout.trim();
      if (merged.length === 0) {
        return yield* new DiscoveryAgentError({
          agent: "claude",
          operation: "merge",
          detail: "Merge agent produced empty output",
        });
      }

      return merged;
    });

  return { merge } satisfies ReportMergerShape;
});

export const ReportMergerLive = Layer.effect(ReportMerger, makeReportMerger);
