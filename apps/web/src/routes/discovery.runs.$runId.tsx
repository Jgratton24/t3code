import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  XCircle,
  Clock,
  Loader2,
  FileText,
  Terminal,
} from "lucide-react";

import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  discoveryRunStatusQueryOptions,
  discoveryReportQueryOptions,
  discoveryTriageListQueryOptions,
  discoveryCancelRunMutation,
} from "~/lib/discoveryReactQuery";
import { useDiscoveryStore } from "~/store/discoveryStore";
import { DiscoveryReportViewer } from "~/components/DiscoveryReportViewer";
import { DiscoveryProgress } from "~/components/DiscoveryProgress";
import { DiscoveryLogViewer } from "~/components/DiscoveryLogViewer";
import { DiscoveryTriageInline } from "~/components/DiscoveryTriageInline";

function DiscoveryRunView() {
  const { runId } = Route.useParams();
  const queryClient = useQueryClient();
  const markRunViewed = useDiscoveryStore((s) => s.markRunViewed);

  const { data: status } = useQuery(discoveryRunStatusQueryOptions(runId));
  const isActive =
    status?.phase &&
    !["completed", "failed", "cancelled"].includes(status.phase);

  const { data: report } = useQuery({
    ...discoveryReportQueryOptions(runId),
    enabled: !isActive,
  });
  const { data: triageItems } = useQuery({
    ...discoveryTriageListQueryOptions(runId),
    enabled: !isActive,
  });

  const cancelRun = useMutation(discoveryCancelRunMutation(queryClient));

  const [activeTab, setActiveTab] = useState("report");

  // Mark as viewed when component mounts
  useEffect(() => {
    markRunViewed(runId);
  }, [runId, markRunViewed]);

  // Auto-switch to report tab when run completes
  useEffect(() => {
    if (!isActive && report) {
      setActiveTab("report");
    }
  }, [isActive, report]);

  // Build tab list
  const tabs = [
    { id: "report", label: "Merged Report", icon: FileText },
    ...(report?.agentReports ?? []).map((ar) => ({
      id: `agent-${ar.agent}`,
      label: ar.agent,
      icon: undefined,
    })),
    ...(triageItems && triageItems.length > 0
      ? [
          {
            id: "triage",
            label: `Triage (${triageItems.filter((t) => t.status === "open").length} open)`,
            icon: undefined,
          },
        ]
      : []),
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Run: {runId}</h1>
            {status && (
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="outline">{status.scope}</Badge>
                <Badge variant="secondary">{status.mode}</Badge>
                <Badge
                  variant={
                    status.phase === "completed"
                      ? "default"
                      : status.phase === "failed"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {isActive && <Loader2 className="mr-1 h-3 w-3 animate-spin" />}
                  {status.phase}
                </Badge>
                {status.elapsedSeconds !== undefined && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {Math.round(status.elapsedSeconds)}s
                  </span>
                )}
              </div>
            )}
          </div>
          {isActive && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => cancelRun.mutate(runId)}
              disabled={cancelRun.isPending}
            >
              <XCircle className="mr-1 h-4 w-4" />
              Cancel Run
            </Button>
          )}
        </div>

        {/* Active Run: Progress View */}
        {isActive && status && <DiscoveryProgress status={status} />}

        {/* Active Run: Live Log */}
        {isActive && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Terminal className="h-4 w-4" />
                Agent Logs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DiscoveryLogViewer runId={runId} agents={status?.agents ?? []} />
            </CardContent>
          </Card>
        )}

        {/* Completed Run: Tab bar + Content */}
        {!isActive && (
          <div className="space-y-4">
            {/* Tab bar using Toggle/Button group */}
            <div className="flex gap-1 rounded-lg border bg-muted/50 p-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {tab.icon && <tab.icon className="h-3.5 w-3.5" />}
                  <span className="capitalize">{tab.label}</span>
                </button>
              ))}
            </div>

            {/* Tab content */}
            {activeTab === "report" && (
              <>
                {report ? (
                  <DiscoveryReportViewer markdown={report.mergedMarkdown} runId={runId} />
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      {status?.phase === "failed"
                        ? `Run failed: ${status.error ?? "Unknown error"}`
                        : "Report not yet available"}
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {(report?.agentReports ?? []).map((ar) =>
              activeTab === `agent-${ar.agent}` ? (
                <DiscoveryReportViewer key={ar.agent} markdown={ar.markdown} runId={runId} />
              ) : null,
            )}

            {activeTab === "triage" && triageItems && triageItems.length > 0 && (
              <DiscoveryTriageInline items={triageItems} runId={runId} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute("/discovery/runs/$runId")({
  component: DiscoveryRunView,
});
