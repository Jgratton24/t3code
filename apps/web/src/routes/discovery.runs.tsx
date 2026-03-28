import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { History, CheckCircle2, XCircle, Clock, AlertTriangle } from "lucide-react";

import { Badge } from "~/components/ui/badge";
import { Card, CardContent } from "~/components/ui/card";
import { discoveryRunListQueryOptions } from "~/lib/discoveryReactQuery";

function DiscoveryRunHistory() {
  const { data: runs, isLoading } = useQuery(discoveryRunListQueryOptions(50));

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="flex items-center gap-3">
          <History className="h-6 w-6 text-primary" />
          <h1 className="text-xl font-bold">Run History</h1>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">Loading runs...</p>}

        {runs && runs.length === 0 && (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No discovery runs yet. Start one from the Dashboard.
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          {runs?.map((run) => {
            const statusColor =
              run.phase === "completed" && run.agentsFailed === 0
                ? "border-l-green-500"
                : run.phase === "completed"
                  ? "border-l-amber-500"
                  : run.phase === "failed"
                    ? "border-l-red-500"
                    : "border-l-blue-500";

            return (
              <Link key={run.runId} to={`/discovery/runs/${run.runId}` as any}>
                <Card className={`border-l-4 ${statusColor} transition-colors hover:bg-muted/50`}>
                  <CardContent className="flex items-center gap-4 py-4">
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{run.runId}</span>
                        <Badge variant="outline">{run.scope}</Badge>
                        <Badge variant="secondary">{run.mode}</Badge>
                        <Badge
                          variant={
                            run.phase === "completed"
                              ? "default"
                              : run.phase === "failed"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {run.phase}
                        </Badge>
                        {run.scheduled && (
                          <Badge variant="outline" className="text-xs">
                            <Clock className="mr-1 h-3 w-3" />
                            Scheduled
                          </Badge>
                        )}
                      </div>
                      <div className="flex gap-4 text-xs text-muted-foreground">
                        <span>{new Date(run.startedAt).toLocaleString()}</span>
                        {run.durationSeconds && <span>{Math.round(run.durationSeconds)}s</span>}
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                          {run.agentsSucceeded}
                        </span>
                        {run.agentsFailed > 0 && (
                          <span className="flex items-center gap-1">
                            <XCircle className="h-3 w-3 text-red-600" />
                            {run.agentsFailed}
                          </span>
                        )}
                        {run.triageTotal > 0 && (
                          <span>
                            Triage: {run.triageTotal - run.triageOpen}/{run.triageTotal}
                          </span>
                        )}
                      </div>
                    </div>
                    {run.error && (
                      <AlertTriangle className="h-4 w-4 text-destructive" />
                    )}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/discovery/runs")({
  component: DiscoveryRunHistory,
});
