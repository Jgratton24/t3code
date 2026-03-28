/**
 * Discovery domain errors.
 *
 * @module Discovery/Errors
 */
import { Schema } from "effect";

export class DiscoveryEngineError extends Schema.TaggedErrorClass<DiscoveryEngineError>()(
  "DiscoveryEngineError",
  {
    operation: Schema.String,
    detail: Schema.String,
    cause: Schema.optional(Schema.Defect),
  },
) {
  override get message(): string {
    return `Discovery engine error in ${this.operation}: ${this.detail}`;
  }
}

export class DiscoveryAgentError extends Schema.TaggedErrorClass<DiscoveryAgentError>()(
  "DiscoveryAgentError",
  {
    agent: Schema.String,
    operation: Schema.String,
    detail: Schema.String,
    exitCode: Schema.optional(Schema.Int),
    timedOut: Schema.optional(Schema.Boolean),
    cause: Schema.optional(Schema.Defect),
  },
) {
  override get message(): string {
    const suffix = this.timedOut ? " (timed out)" : this.exitCode ? ` (exit ${this.exitCode})` : "";
    return `Discovery agent ${this.agent} error in ${this.operation}: ${this.detail}${suffix}`;
  }
}

export class DiscoveryNotFoundError extends Schema.TaggedErrorClass<DiscoveryNotFoundError>()(
  "DiscoveryNotFoundError",
  {
    entity: Schema.String,
    id: Schema.String,
  },
) {
  override get message(): string {
    return `Discovery ${this.entity} not found: ${this.id}`;
  }
}

export class DiscoveryBudgetError extends Schema.TaggedErrorClass<DiscoveryBudgetError>()(
  "DiscoveryBudgetError",
  {
    agent: Schema.String,
    reason: Schema.String,
    cooldownUntil: Schema.optional(Schema.String),
  },
) {
  override get message(): string {
    return `Discovery budget guard triggered for ${this.agent}: ${this.reason}`;
  }
}

export type DiscoveryServiceError =
  | DiscoveryEngineError
  | DiscoveryAgentError
  | DiscoveryNotFoundError
  | DiscoveryBudgetError;
