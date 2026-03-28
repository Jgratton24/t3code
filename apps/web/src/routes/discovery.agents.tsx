import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Activity, RefreshCw, Clock, CheckCircle2, XCircle } from "lucide-react";

import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import {
  discoveryAgentHealthQueryOptions,
  discoveryResetCooldownMutation,
} from "~/lib/discoveryReactQuery";

function DiscoveryAgentHealth() {
  const queryClient = useQueryClient();
  const { data: agentHealth, isLoading } = useQuery(discoveryAgentHealthQueryOptions());
  const resetCooldown = useMutation(discoveryResetCooldownMutation(queryClient));

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">Agent Health</h1>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}

        <div className="grid gap-4 md:grid-cols-2">
          {(agentHealth ?? []).map((agent) => (
            <Card key={agent.agent}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 capitalize">
                    <div
                      className={`h-3 w-3 rounded-full ${
                        agent.status === "healthy"
                          ? "bg-green-500"
                          : agent.status === "cooldown"
                            ? "bg-amber-500 animate-pulse"
                            : "bg-red-500"
                      }`}
                    />
                    {agent.agent}
                  </CardTitle>
                  <Badge
                    variant={
                      agent.status === "healthy"
                        ? "default"
                        : agent.status === "cooldown"
                          ? "secondary"
                          : "destructive"
                    }
                  >
                    {agent.status}
                  </Badge>
                </div>
                <CardDescription>
                  {agent.agent === "codex"
                    ? "Breadth scanner — wide coverage across codebase"
                    : "Depth analyzer — thorough analysis of key findings"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {agent.status === "cooldown" && (
                  <div className="space-y-2">
                    {agent.cooldownUntil && (
                      <p className="flex items-center gap-1 text-sm text-amber-600">
                        <Clock className="h-3 w-3" />
                        Cooldown until: {new Date(agent.cooldownUntil).toLocaleString()}
                      </p>
                    )}
                    {agent.cooldownReason && (
                      <p className="text-sm text-muted-foreground">
                        Reason: {agent.cooldownReason}
                      </p>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => resetCooldown.mutate(agent.agent)}
                      disabled={resetCooldown.isPending}
                    >
                      <RefreshCw className="mr-1 h-3 w-3" />
                      Reset Cooldown
                    </Button>
                  </div>
                )}
                {agent.lastSeenAt && (
                  <p className="text-xs text-muted-foreground">
                    Last seen: {new Date(agent.lastSeenAt).toLocaleString()}
                  </p>
                )}
                {agent.lastFiveResults.length > 0 && (
                  <div className="flex gap-1">
                    {agent.lastFiveResults.map((result, i) => (
                      <div
                        key={i}
                        className={`h-2 w-2 rounded-full ${
                          result === "succeeded"
                            ? "bg-green-500"
                            : result === "failed"
                              ? "bg-red-500"
                              : result === "timed-out"
                                ? "bg-amber-500"
                                : "bg-zinc-400"
                        }`}
                        title={result}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {agentHealth && agentHealth.some((a) => a.status === "cooldown") && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={() => {
                for (const agent of agentHealth.filter((a) => a.status === "cooldown")) {
                  resetCooldown.mutate(agent.agent);
                }
              }}
              disabled={resetCooldown.isPending}
            >
              <RefreshCw className="mr-1 h-4 w-4" />
              Reset All Cooldowns
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/discovery/agents")({
  component: DiscoveryAgentHealth,
});
