/**
 * ContextGathererLive - Gathers repository context for discovery prompts.
 *
 * Assembles directory tree, git diffs, git status, and key documentation
 * from the project working directory.
 *
 * @module Discovery/Layers/ContextGatherer
 */
import { Effect, Layer } from "effect";
import type { ContextGathererShape } from "../Services/ContextGatherer";
import { ContextGatherer } from "../Services/ContextGatherer";
import { DiscoveryEngineError } from "../Errors";
import { ServerConfig } from "../../config";
import { runProcess } from "../../processRunner";

const makeContextGatherer = Effect.gen(function* () {
  const { cwd } = yield* ServerConfig;

  const gather: ContextGathererShape["gather"] = () =>
    Effect.gen(function* () {
      const sections: string[] = [];

      // Directory tree (maxdepth 3, excluding common noise)
      const treeResult = yield* Effect.tryPromise({
        try: () =>
          runProcess(
            "find",
            [
              ".",
              "-maxdepth",
              "3",
              "-not",
              "-path",
              "*/node_modules/*",
              "-not",
              "-path",
              "*/.git/*",
              "-not",
              "-path",
              "*/dist/*",
              "-not",
              "-path",
              "*/__pycache__/*",
            ],
            { cwd, timeoutMs: 10_000, allowNonZeroExit: true, outputMode: "truncate", maxBufferBytes: 64 * 1024 },
          ),
        catch: () => ({ stdout: "(tree unavailable)", stderr: "", code: 1, signal: null, timedOut: false }),
      });

      // Limit tree output to 400 lines
      const treeLines = treeResult.stdout.split("\n").slice(0, 400);
      sections.push(`## Directory Tree\n\n\`\`\`\n${treeLines.join("\n")}\n\`\`\``);

      // Git status
      const statusResult = yield* Effect.tryPromise({
        try: () =>
          runProcess("git", ["status", "--porcelain"], {
            cwd,
            timeoutMs: 10_000,
            allowNonZeroExit: true,
          }),
        catch: () => ({ stdout: "", stderr: "", code: 1, signal: null, timedOut: false }),
      });
      if (statusResult.stdout.trim()) {
        sections.push(`## Git Status\n\n\`\`\`\n${statusResult.stdout.trim()}\n\`\`\``);
      }

      // Git diff (working tree, limited)
      const diffResult = yield* Effect.tryPromise({
        try: () =>
          runProcess("git", ["diff", "--stat"], {
            cwd,
            timeoutMs: 10_000,
            allowNonZeroExit: true,
            outputMode: "truncate",
            maxBufferBytes: 64 * 1024,
          }),
        catch: () => ({ stdout: "", stderr: "", code: 1, signal: null, timedOut: false }),
      });
      if (diffResult.stdout.trim()) {
        sections.push(`## Git Diff Summary\n\n\`\`\`\n${diffResult.stdout.trim()}\n\`\`\``);
      }

      // Recent commits
      const logResult = yield* Effect.tryPromise({
        try: () =>
          runProcess("git", ["log", "--oneline", "-20"], {
            cwd,
            timeoutMs: 10_000,
            allowNonZeroExit: true,
          }),
        catch: () => ({ stdout: "", stderr: "", code: 1, signal: null, timedOut: false }),
      });
      if (logResult.stdout.trim()) {
        sections.push(`## Recent Commits\n\n\`\`\`\n${logResult.stdout.trim()}\n\`\`\``);
      }

      // Key documentation files
      const docFiles = [
        "CLAUDE.md",
        "AGENTS.md",
        "README.md",
        "CONTRIBUTING.md",
      ];
      for (const docFile of docFiles) {
        const catResult = yield* Effect.tryPromise({
          try: () =>
            runProcess("cat", [docFile], {
              cwd,
              timeoutMs: 5_000,
              allowNonZeroExit: true,
              outputMode: "truncate",
              maxBufferBytes: 32 * 1024,
            }),
          catch: () => ({ stdout: "", stderr: "", code: 1, signal: null, timedOut: false }),
        });
        if (catResult.stdout.trim() && (catResult.code === 0 || catResult.code === null)) {
          const lines = catResult.stdout.split("\n").slice(0, 300);
          sections.push(`## ${docFile}\n\n${lines.join("\n")}`);
        }
      }

      if (sections.length === 0) {
        return yield* new DiscoveryEngineError({
          operation: "gatherContext",
          detail: "No context could be gathered from the project",
        });
      }

      return sections.join("\n\n---\n\n");
    });

  return { gather } satisfies ContextGathererShape;
});

export const ContextGathererLive = Layer.effect(ContextGatherer, makeContextGatherer);
