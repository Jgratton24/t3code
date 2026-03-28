/**
 * HistoryManagerLive - Cross-run dedup digest extraction.
 *
 * Reads previous discovery reports from the database and extracts
 * Top Opportunities + Open Questions for injection into new prompts.
 *
 * @module Discovery/Layers/HistoryManager
 */
import { Effect, Layer } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import type { HistoryManagerShape } from "../Services/HistoryManager";
import { HistoryManager } from "../Services/HistoryManager";
import { DiscoveryEngineError } from "../Errors";

const MAX_HISTORY_RUNS = 3;
const MAX_ITEMS_PER_RUN = 5;

/**
 * Extract a section from markdown by heading name.
 * Returns up to maxItems bullet points from the section.
 */
function extractSection(markdown: string, heading: string, maxItems: number): string[] {
  const regex = new RegExp(
    `###\\s*${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^\\n]*\\n([\\s\\S]*?)(?=\\n###|\\n##|$)`,
    "i",
  );
  const match = markdown.match(regex);
  if (!match?.[1]) return [];

  return match[1]
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[-*\d]/.test(l))
    .slice(0, maxItems);
}

const makeHistoryManager = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const getDigest: HistoryManagerShape["getDigest"] = () =>
    Effect.gen(function* () {
      const rows = yield* sql`
        SELECT r.id, r.started_at, dr.merged_markdown
        FROM discovery_runs r
        JOIN discovery_reports dr ON dr.run_id = r.id
        WHERE r.phase = 'completed'
        ORDER BY r.started_at DESC
        LIMIT ${MAX_HISTORY_RUNS}
      `.pipe(
        Effect.mapError(
          (cause) =>
            new DiscoveryEngineError({
              operation: "getHistoryDigest",
              detail: "Failed to query history runs",
              cause,
            }),
        ),
      );

      if ((rows as any[]).length === 0) {
        return "*No previous runs available.*";
      }

      const digestParts: string[] = [];
      for (const row of rows as any[]) {
        const markdown = row.merged_markdown as string;
        const opportunities = extractSection(markdown, "Top Opportunities", MAX_ITEMS_PER_RUN);
        const questions = extractSection(markdown, "Open Questions", MAX_ITEMS_PER_RUN);

        if (opportunities.length > 0 || questions.length > 0) {
          const parts = [`**Run ${row.started_at}:**`];
          if (opportunities.length > 0) {
            parts.push("Top Opportunities:");
            parts.push(...opportunities);
          }
          if (questions.length > 0) {
            parts.push("Open Questions:");
            parts.push(...questions);
          }
          digestParts.push(parts.join("\n"));
        }
      }

      return digestParts.length > 0
        ? digestParts.join("\n\n")
        : "*No previous runs available.*";
    });

  return { getDigest } satisfies HistoryManagerShape;
});

export const HistoryManagerLive = Layer.effect(HistoryManager, makeHistoryManager);
