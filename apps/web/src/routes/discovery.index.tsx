import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Telescope,
  Play,
  Clock,
  CheckCircle2,
  XCircle,
  ChevronRight,
} from "lucide-react";
import type { DiscoveryRunConfig } from "@t3tools/contracts";

import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import {
  discoveryRunListQueryOptions,
  discoveryAgentHealthQueryOptions,
  discoveryStartRunMutation,
} from "~/lib/discoveryReactQuery";
import { useDiscoveryStore } from "~/store/discoveryStore";
import { DiscoveryRunConfig as RunConfigSheet } from "~/components/DiscoveryRunConfig";

function DiscoveryDashboard() {
  const queryClient = useQueryClient();
  const [configOpen, setConfigOpen] = useState(false);
  const activeRunId = useDiscoveryStore((s) => s.activeRunId);
  const activeRunStatus = useDiscoveryStore((s) => s.activeRunStatus);

  const { data: runs } = useQuery(discoveryRunListQueryOptions(5));
  const { data: agentHealth } = useQuery(discoveryAgentHealthQueryOptions());

  const startRun = useMutation(discoveryStartRunMutation(queryClient));

  const latestRun = runs?.[0];

  const handleStartRun = (config: DiscoveryRunConfig) => {
    startRun.mutate(config);
    setConfigOpen(false);
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Telescope className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">AI Discovery</h1>
              <p className="text-sm text-muted-foreground">
                Automated codebase analysis and opportunity discovery
              </p>
            </div>
          </div>
          <Button
            onClick={() => setConfigOpen(true)}
            disabled={activeRunId !== null || startRun.isPending}
          >
            <Play className="mr-2 h-4 w-4" />
            New Discovery Run
          </Button>
        </div>

        {/* Active Run Banner */}
        {activeRunId && activeRunStatus && (
          <Card className="border-blue-500/50 bg-blue-500/5">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="h-3 w-3 animate-pulse rounded-full bg-blue-500" />
              <div className="flex-1">
                <p className="text-sm font-medium">Run in progress: {activeRunId}</p>
                <p className="text-xs text-muted-foreground">
                  Phase: {activeRunStatus.phase} &middot; Scope: {activeRunStatus.scope}
                </p>
              </div>
              <Link to={`/discovery/runs/${activeRunId}` as any}>
                <Button variant="outline" size="sm">
                  View Progress
                  <ChevronRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}

        {/* Last Run Card */}
        {latestRun && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Last Run</CardTitle>
              <CardDescription>
                {new Date(latestRun.startedAt).toLocaleString()} &middot;{" "}
                <Badge variant={latestRun.phase === "completed" ? "default" : "destructive"}>
                  {latestRun.phase}
                </Badge>
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1">
                  <Badge variant="outline">{latestRun.scope}</Badge>
                </span>
                <span className="flex items-center gap-1">
                  <Badge variant="secondary">{latestRun.mode}</Badge>
                </span>
                {latestRun.durationSeconds && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {Math.round(latestRun.durationSeconds)}s
                  </span>
                )}
              </div>
              <div className="flex gap-4 text-sm">
                <span className="flex items-center gap-1 text-green-600">
                  <CheckCircle2 className="h-3 w-3" />
                  {latestRun.agentsSucceeded} succeeded
                </span>
                {latestRun.agentsFailed > 0 && (
                  <span className="flex items-center gap-1 text-red-600">
                    <XCircle className="h-3 w-3" />
                    {latestRun.agentsFailed} failed
                  </span>
                )}
                {latestRun.triageTotal > 0 && (
                  <span className="text-muted-foreground">
                    Triage: {latestRun.triageTotal - latestRun.triageOpen}/{latestRun.triageTotal}
                  </span>
                )}
              </div>
              <div className="flex justify-end">
                <Link to={`/discovery/runs/${latestRun.runId}` as any}>
                  <Button variant="ghost" size="sm">
                    View Report
                    <ChevronRight className="ml-1 h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Agent Health Strip */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Agent Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4">
              {(agentHealth ?? []).map((agent) => (
                <div key={agent.agent} className="flex items-center gap-2">
                  <div
                    className={`h-3 w-3 rounded-full ${
                      agent.status === "healthy"
                        ? "bg-green-500"
                        : agent.status === "cooldown"
                          ? "bg-amber-500"
                          : "bg-red-500"
                    }`}
                  />
                  <span className="text-sm font-medium capitalize">{agent.agent}</span>
                  {agent.status === "cooldown" && agent.cooldownUntil && (
                    <span className="text-xs text-muted-foreground">
                      until {new Date(agent.cooldownUntil).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              ))}
              {(!agentHealth || agentHealth.length === 0) && (
                <p className="text-sm text-muted-foreground">No agent data yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Runs */}
        {runs && runs.length > 1 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Recent Runs</CardTitle>
              <Link to={"/discovery/runs" as any}>
                <Button variant="ghost" size="sm">
                  View All
                  <ChevronRight className="ml-1 h-3 w-3" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {runs.slice(1).map((run) => (
                  <Link
                    key={run.runId}
                    to={`/discovery/runs/${run.runId}` as any}
                    className="flex items-center justify-between rounded-md px-3 py-2 hover:bg-muted"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-2 w-2 rounded-full ${
                          run.phase === "completed" && run.agentsFailed === 0
                            ? "bg-green-500"
                            : run.phase === "completed"
                              ? "bg-amber-500"
                              : run.phase === "failed"
                                ? "bg-red-500"
                                : "bg-blue-500"
                        }`}
                      />
                      <span className="text-sm">
                        {new Date(run.startedAt).toLocaleDateString()}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {run.scope}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {run.durationSeconds ? `${Math.round(run.durationSeconds)}s` : "—"}
                    </span>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Run Configuration Sheet */}
      <RunConfigSheet
        open={configOpen}
        onOpenChange={setConfigOpen}
        onSubmit={handleStartRun}
        isSubmitting={startRun.isPending}
      />
    </div>
  );
}

export const Route = createFileRoute("/discovery/")({
  component: DiscoveryDashboard,
});
