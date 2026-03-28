/**
 * DiscoveryProgress - Live progress view for an active discovery run.
 *
 * Shows: phase stepper, elapsed timer, per-agent status cards.
 */
import { useState, useEffect } from "react";
import { CheckCircle2, Loader2, Circle, XCircle, Clock } from "lucide-react";
import type { DiscoveryRunStatus } from "@t3tools/contracts";

import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";

const PHASES = [
  { id: "gathering-context", label: "Context" },
  { id: "assembling-prompts", label: "Prompts" },
  { id: "running-agents", label: "Agents" },
  { id: "merging-reports", label: "Merge" },
  { id: "completed", label: "Done" },
] as const;

function phaseIndex(phase: string): number {
  return PHASES.findIndex((p) => p.id === phase);
}

interface DiscoveryProgressProps {
  status: DiscoveryRunStatus;
}

export function DiscoveryProgress({ status }: DiscoveryProgressProps) {
  const [elapsed, setElapsed] = useState(0);

  // Ticking elapsed timer
  useEffect(() => {
    const start = new Date(status.startedAt).getTime();
    const interval = setInterval(() => {
      setElapsed(Math.round((Date.now() - start) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [status.startedAt]);

  const currentPhaseIdx = phaseIndex(status.phase);

  return (
    <div className="space-y-4">
      {/* Phase Stepper */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            {PHASES.map((phase, i) => {
              const isCompleted = i < currentPhaseIdx;
              const isActive = i === currentPhaseIdx;
              const isFailed = status.phase === "failed" && i === currentPhaseIdx;

              return (
                <div key={phase.id} className="flex flex-1 items-center">
                  <div className="flex flex-col items-center gap-1">
                    {isFailed ? (
                      <XCircle className="h-5 w-5 text-destructive" />
                    ) : isCompleted ? (
                      <CheckCircle2 className="h-5 w-5 text-green-500" />
                    ) : isActive ? (
                      <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                    ) : (
                      <Circle className="h-5 w-5 text-muted-foreground/40" />
                    )}
                    <span
                      className={`text-xs ${
                        isActive
                          ? "font-semibold text-foreground"
                          : isCompleted
                            ? "text-muted-foreground"
                            : "text-muted-foreground/40"
                      }`}
                    >
                      {phase.label}
                    </span>
                  </div>
                  {i < PHASES.length - 1 && (
                    <div
                      className={`mx-2 h-px flex-1 ${
                        i < currentPhaseIdx ? "bg-green-500" : "bg-muted-foreground/20"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center justify-center gap-1 text-sm text-muted-foreground">
            <Clock className="h-3 w-3" />
            {elapsed}s elapsed
          </div>
        </CardContent>
      </Card>

      {/* Agent Cards */}
      <div className="grid gap-3 md:grid-cols-2">
        {status.agents.map((agent) => {
          const statusColor =
            agent.status === "running"
              ? "border-blue-500/50"
              : agent.status === "succeeded"
                ? "border-green-500/50"
                : agent.status === "failed" || agent.status === "timed-out"
                  ? "border-red-500/50"
                  : "border-muted";

          return (
            <Card key={agent.agent} className={`border-l-4 ${statusColor}`}>
              <CardContent className="flex items-center gap-3 py-3">
                {agent.status === "running" ? (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                ) : agent.status === "succeeded" ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : agent.status === "failed" || agent.status === "timed-out" ? (
                  <XCircle className="h-4 w-4 text-destructive" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground/40" />
                )}
                <div className="flex-1">
                  <span className="text-sm font-medium capitalize">{agent.agent}</span>
                  {agent.role && (
                    <Badge variant="outline" className="ml-2 text-xs">
                      {agent.role}
                    </Badge>
                  )}
                </div>
                <Badge
                  variant={
                    agent.status === "succeeded"
                      ? "default"
                      : agent.status === "running"
                        ? "secondary"
                        : agent.status === "failed" || agent.status === "timed-out"
                          ? "destructive"
                          : "outline"
                  }
                  className="text-xs"
                >
                  {agent.status}
                </Badge>
                {agent.durationSeconds !== undefined && (
                  <span className="text-xs text-muted-foreground">{agent.durationSeconds}s</span>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
