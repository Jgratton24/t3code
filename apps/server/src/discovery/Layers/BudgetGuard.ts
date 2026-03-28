/**
 * BudgetGuardLive - Rate limit detection and cooldown management.
 *
 * Scans agent error output for rate-limit and billing error signatures,
 * and manages per-agent cooldowns in SQLite.
 *
 * @module Discovery/Layers/BudgetGuard
 */
import { Effect, Layer } from "effect";
import * as SqlClient from "effect/unstable/sql/SqlClient";
import type { DiscoveryAgentName } from "@t3tools/contracts";
import type { BudgetGuardShape } from "../Services/BudgetGuard";
import { BudgetGuard } from "../Services/BudgetGuard";
import { DiscoveryBudgetError } from "../Errors";

/** Error signatures that indicate rate limiting or billing issues */
const ERROR_SIGNATURES = [
  "rate limit exceeded",
  "too many requests",
  "quota exceeded",
  "insufficient_quota",
  "billing",
  "resource exhausted",
  "429",
  "rate_limit_error",
  "overloaded",
];

const DEFAULT_COOLDOWN_HOURS = 6;

const makeBudgetGuard = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const filterEligible: BudgetGuardShape["filterEligible"] = (agents) =>
    Effect.gen(function* () {
      const rows = yield* sql`
        SELECT agent, cooldown_until FROM discovery_agent_health
        WHERE cooldown_until IS NOT NULL
      `.pipe(
        Effect.mapError(
          (cause) =>
            new DiscoveryBudgetError({
              agent: "all",
              reason: `Failed to check agent health: ${String(cause)}`,
            }),
        ),
      );

      const now = new Date();
      const cooledDown = new Set<string>();
      for (const row of rows as any[]) {
        if (row.cooldown_until && new Date(row.cooldown_until) > now) {
          cooledDown.add(row.agent);
        }
      }

      return agents.filter((a) => !cooledDown.has(a)) as DiscoveryAgentName[];
    });

  const checkAndCooldown: BudgetGuardShape["checkAndCooldown"] = (agent, errorOutput) =>
    Effect.gen(function* () {
      const lowerOutput = errorOutput.toLowerCase();
      const matchedSignature = ERROR_SIGNATURES.find((sig) =>
        lowerOutput.includes(sig.toLowerCase()),
      );

      if (!matchedSignature) return;

      const cooldownUntil = new Date(
        Date.now() + DEFAULT_COOLDOWN_HOURS * 60 * 60 * 1000,
      ).toISOString();

      yield* sql`
        INSERT INTO discovery_agent_health (agent, status, cooldown_until, cooldown_reason, last_seen_at)
        VALUES (${agent}, ${"cooldown"}, ${cooldownUntil}, ${matchedSignature}, ${new Date().toISOString()})
        ON CONFLICT(agent) DO UPDATE SET
          status = excluded.status,
          cooldown_until = excluded.cooldown_until,
          cooldown_reason = excluded.cooldown_reason,
          last_seen_at = excluded.last_seen_at
      `.pipe(
        Effect.mapError(
          (cause) =>
            new DiscoveryBudgetError({
              agent,
              reason: `Failed to set cooldown: ${String(cause)}`,
              cooldownUntil,
            }),
        ),
      );
    });

  return { filterEligible, checkAndCooldown } satisfies BudgetGuardShape;
});

export const BudgetGuardLive = Layer.effect(BudgetGuard, makeBudgetGuard);
