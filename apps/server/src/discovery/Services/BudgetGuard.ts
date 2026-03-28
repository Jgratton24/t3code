/**
 * BudgetGuard - Rate limit detection and cooldown management.
 *
 * Scans agent error output for rate-limit/billing signatures and
 * sets per-agent cooldowns to prevent repeated failures.
 *
 * @module Discovery/Services/BudgetGuard
 */
import { Effect, ServiceMap } from "effect";
import type { DiscoveryAgentName } from "@t3tools/contracts";
import type { DiscoveryBudgetError } from "../Errors";

export interface BudgetGuardShape {
  /** Filter agents, removing any currently on cooldown. */
  readonly filterEligible: (
    agents: readonly DiscoveryAgentName[],
  ) => Effect.Effect<DiscoveryAgentName[], DiscoveryBudgetError>;

  /** Check error output and apply cooldown if budget signatures found. */
  readonly checkAndCooldown: (
    agent: DiscoveryAgentName,
    errorOutput: string,
  ) => Effect.Effect<void, DiscoveryBudgetError>;
}

export class BudgetGuard extends ServiceMap.Service<BudgetGuard, BudgetGuardShape>()(
  "t3/discovery/Services/BudgetGuard",
) {}
