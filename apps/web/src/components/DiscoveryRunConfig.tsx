/**
 * DiscoveryRunConfig - Run configuration sheet/drawer.
 *
 * Provides: scope selector, agent checkboxes, mode tabs,
 * custom prompt textarea, advanced options.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Play, Settings } from "lucide-react";
import type {
  DiscoveryRunConfig as RunConfigType,
  DiscoveryScope,
  DiscoveryAgentName,
  DiscoveryPromptMode,
} from "@t3tools/contracts";

import { Button } from "~/components/ui/button";
import { Checkbox } from "~/components/ui/checkbox";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "~/components/ui/sheet";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "~/components/ui/collapsible";
import { discoveryAgentHealthQueryOptions } from "~/lib/discoveryReactQuery";

interface DiscoveryRunConfigProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (config: RunConfigType) => void;
  isSubmitting: boolean;
}

const SCOPE_OPTIONS: Array<{ value: DiscoveryScope; label: string; description: string }> = [
  {
    value: "full",
    label: "Full Audit",
    description: "Complete codebase analysis across all dimensions",
  },
  {
    value: "product",
    label: "Product & UX",
    description: "User-facing features, interaction flows, accessibility",
  },
  {
    value: "techdebt",
    label: "Tech Debt",
    description: "Code quality, architecture issues, performance",
  },
  {
    value: "guided-intelligence",
    label: "Guided Intelligence",
    description: "AI/ML integration opportunities and automation",
  },
];

const AGENT_OPTIONS: Array<{ value: DiscoveryAgentName; label: string; role: string }> = [
  { value: "codex", label: "Codex", role: "Breadth Scanner" },
  { value: "claude", label: "Claude", role: "Depth Analyzer" },
];

export function DiscoveryRunConfig({
  open,
  onOpenChange,
  onSubmit,
  isSubmitting,
}: DiscoveryRunConfigProps) {
  const [scope, setScope] = useState<DiscoveryScope>("full");
  const [agents, setAgents] = useState<DiscoveryAgentName[]>(["codex", "claude"]);
  const [mode, setMode] = useState<DiscoveryPromptMode>("discovery");
  const [customPrompt, setCustomPrompt] = useState("");
  const [focus, setFocus] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const { data: agentHealth } = useQuery(discoveryAgentHealthQueryOptions());

  const toggleAgent = (agent: DiscoveryAgentName) => {
    setAgents((prev) =>
      prev.includes(agent) ? prev.filter((a) => a !== agent) : [...prev, agent],
    );
  };

  const handleSubmit = () => {
    const config: RunConfigType = {
      scope,
      agents,
      mode,
      ...(mode === "custom" && customPrompt ? { customPrompt } : {}),
      ...(focus.trim() ? { focus: focus.trim() } : {}),
    };
    onSubmit(config);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[440px] overflow-y-auto sm:max-w-[440px]">
        <SheetHeader>
          <SheetTitle>New Discovery Run</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Scope Selector */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Scope</h3>
            <div className="grid gap-2">
              {SCOPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setScope(option.value)}
                  className={`rounded-lg border p-3 text-left transition-colors ${
                    scope === option.value
                      ? "border-primary bg-primary/5"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <p className="text-sm font-medium">{option.label}</p>
                  <p className="text-xs text-muted-foreground">{option.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Agent Checkboxes */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Agents</h3>
            <div className="space-y-2">
              {AGENT_OPTIONS.map((option) => {
                const health = agentHealth?.find((h) => h.agent === option.value);
                const isOnCooldown = health?.status === "cooldown";

                return (
                  <label
                    key={option.value}
                    className={`flex items-center gap-3 rounded-lg border p-3 ${
                      isOnCooldown ? "opacity-60" : ""
                    }`}
                  >
                    <Checkbox
                      checked={agents.includes(option.value)}
                      onCheckedChange={() => toggleAgent(option.value)}
                      disabled={isOnCooldown}
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {option.label}
                        <span className="ml-2 text-xs text-muted-foreground">{option.role}</span>
                      </p>
                    </div>
                    {health && (
                      <div
                        className={`h-2 w-2 rounded-full ${
                          health.status === "healthy"
                            ? "bg-green-500"
                            : health.status === "cooldown"
                              ? "bg-amber-500"
                              : "bg-red-500"
                        }`}
                      />
                    )}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Mode Tabs */}
          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Mode</h3>
            <div className="flex gap-1 rounded-lg border bg-muted/50 p-1">
              {(["discovery", "custom", "refine"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors ${
                    mode === m
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>

            {mode === "custom" && (
              <Textarea
                placeholder="Enter your custom prompt... Use {{CONTEXT}} to inject repository context."
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                rows={6}
              />
            )}
          </div>

          {/* Advanced Options */}
          <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
            <CollapsibleTrigger className="flex w-full items-center justify-start gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              <Settings className="h-4 w-4" />
              Advanced Options
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2">
              <div>
                <label className="text-xs font-medium">Focus Text</label>
                <Input
                  placeholder="e.g., look at caching strategy"
                  value={focus}
                  onChange={(e) => setFocus(e.target.value)}
                  className="mt-1"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Launch Button */}
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={agents.length === 0 || isSubmitting}
          >
            <Play className="mr-2 h-4 w-4" />
            {isSubmitting ? "Starting..." : "Launch Discovery Run"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
