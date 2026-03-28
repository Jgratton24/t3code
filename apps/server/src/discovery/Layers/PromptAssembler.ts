/**
 * PromptAssemblerLive - Template loading and placeholder substitution.
 *
 * Produces per-agent prompts by injecting scope blocks, history,
 * context, and role directives into templates.
 *
 * @module Discovery/Layers/PromptAssembler
 */
import { Effect, Layer } from "effect";
import type { DiscoveryAgentName, DiscoveryScope } from "@t3tools/contracts";
import type { PromptAssembleInput, PromptAssemblerShape } from "../Services/PromptAssembler";
import { PromptAssembler } from "../Services/PromptAssembler";
import { DiscoveryEngineError } from "../Errors";

// ── Role Directives ─────────────────────────────────────────────────

const DISCOVERY_ROLES: Record<string, Record<string, string>> = {
  discovery: {
    codex:
      "**Scan role — breadth:** Find as many high-impact opportunities as possible. Cast a wide net across the codebase. Prioritize coverage and quantity of distinct findings.",
    claude:
      "**Scan role — depth:** Go deep on the most significant findings. Provide thorough analysis, root cause identification, and detailed improvement recommendations.",
  },
  refine: {
    codex:
      "**Refinement role — implementer:** Focus on actionability. Break findings into concrete implementation steps, estimate effort, and identify dependencies.",
    claude:
      "**Refinement role — challenger:** Stress-test the previous analysis. Challenge assumptions, identify overlooked risks, and deepen the most impactful findings.",
  },
};

// ── Scope Blocks ────────────────────────────────────────────────────

const SCOPE_BLOCKS: Record<DiscoveryScope, string> = {
  full: "Perform a **full audit** of the entire codebase. Cover architecture, code quality, performance, security, testing, documentation, developer experience, and product UX.",
  product:
    "Focus on **product and UX** improvements. Analyze user-facing features, interaction flows, accessibility, design consistency, and feature gaps.",
  techdebt:
    "Focus on **technical debt and reliability**. Analyze code quality, architecture issues, performance bottlenecks, test coverage, error handling, and operational risks.",
  "guided-intelligence":
    "Focus on **AI/ML integration opportunities**. Analyze where intelligent automation, AI-assisted features, or ML-powered improvements could add the most value.",
};

// ── Templates ───────────────────────────────────────────────────────

const DISCOVERY_TEMPLATE = `# Your Role
{{ROLE_DIRECTIVE}}

## Scope
{{SCOPE_BLOCK}}

## Previous Discovery Findings
{{HISTORY}}

## Repository Context
{{CONTEXT}}

## Output Format (strict)
### Executive Summary (max 5 bullets)
### Top Opportunities (ranked by Impact/Effort/Risk)
### UX / Product Refinements
### Tech Debt / Performance / Reliability
### First PR Plan (single best starting point)
### Open Questions / Assumptions
`;

const REFINE_TEMPLATE = `# Your Role
{{ROLE_DIRECTIVE}}

Challenge, deepen, and improve the previous analysis.

## Previous Discovery Report
{{PREVIOUS_REPORT}}

## Refinement Directives
{{DIRECTIVES}}

## Repository Context
{{CONTEXT}}

## Output Format (strict)
### Refinement Summary (3-5 bullets)
### Challenged Findings (incorrect or overstated)
### Deepened Analysis (correct but needs more depth)
### New Findings (not in previous report)
### Revised First PR Plan
### Directive Responses
### Remaining Open Questions
`;

const makePromptAssembler = Effect.gen(function* () {
  const assemble: PromptAssemblerShape["assemble"] = (input: PromptAssembleInput) =>
    Effect.gen(function* () {
      const result = new Map<DiscoveryAgentName, string>();

      for (const agent of input.agents) {
        let prompt: string;

        if (input.mode === "custom" && input.customPrompt) {
          // Custom prompt mode: use user-provided text with context injected
          prompt = input.customPrompt
            .replace("{{CONTEXT}}", input.context)
            .replace("{{HISTORY}}", input.history || "*No previous runs available.*");

          // Prepend role directive if available
          const roleDirective = DISCOVERY_ROLES.discovery?.[agent];
          if (roleDirective) {
            prompt = `${roleDirective}\n\n${prompt}`;
          }
        } else if (input.mode === "refine") {
          // Refine mode: use refine template
          const roleDirective =
            DISCOVERY_ROLES.refine?.[agent] ??
            "Challenge and improve the previous analysis.";

          prompt = REFINE_TEMPLATE.replace("{{ROLE_DIRECTIVE}}", roleDirective)
            .replace("{{PREVIOUS_REPORT}}", input.parentReport ?? "*No parent report available.*")
            .replace("{{DIRECTIVES}}", input.directives ?? "No specific directives provided. Use your judgment to challenge, deepen, and improve the analysis.")
            .replace("{{CONTEXT}}", input.context);
        } else {
          // Discovery mode (default)
          const roleDirective =
            DISCOVERY_ROLES.discovery?.[agent] ??
            "Analyze the codebase for improvement opportunities.";
          const scopeBlock =
            SCOPE_BLOCKS[input.scope] ?? SCOPE_BLOCKS.full;

          prompt = DISCOVERY_TEMPLATE.replace("{{ROLE_DIRECTIVE}}", roleDirective)
            .replace("{{SCOPE_BLOCK}}", scopeBlock)
            .replace("{{HISTORY}}", input.history || "*No previous runs available.*")
            .replace("{{CONTEXT}}", input.context);
        }

        if (prompt.length === 0) {
          return yield* new DiscoveryEngineError({
            operation: "assemblePrompts",
            detail: `Empty prompt generated for agent ${agent}`,
          });
        }

        result.set(agent, prompt);
      }

      return result;
    });

  return { assemble } satisfies PromptAssemblerShape;
});

export const PromptAssemblerLive = Layer.effect(PromptAssembler, makePromptAssembler);
