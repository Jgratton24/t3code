/**
 * DiscoveryTriageInline - Interactive triage controls for open questions.
 *
 * Each question has status indicator + File/Integrate/Dismiss buttons + note.
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  FileText,
  Link,
  XCircle,
  MessageSquare,
  Circle,
} from "lucide-react";
import type { TriageItem, TriageStatus } from "@t3tools/contracts";

import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { discoveryTriageUpdateMutation } from "~/lib/discoveryReactQuery";

interface DiscoveryTriageInlineProps {
  items: readonly TriageItem[];
  runId: string;
}

const STATUS_CONFIG: Record<TriageStatus, { icon: typeof Circle; color: string; label: string }> = {
  open: { icon: Circle, color: "text-muted-foreground", label: "Open" },
  filed: { icon: FileText, color: "text-blue-500", label: "Filed" },
  integrated: { icon: CheckCircle2, color: "text-green-500", label: "Integrated" },
  dismissed: { icon: XCircle, color: "text-zinc-400", label: "Dismissed" },
};

export function DiscoveryTriageInline({ items, runId }: DiscoveryTriageInlineProps) {
  const queryClient = useQueryClient();
  const triageUpdate = useMutation(discoveryTriageUpdateMutation(queryClient));
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});

  const openCount = items.filter((t) => t.status === "open").length;
  const totalCount = items.length;

  const handleStatusChange = (item: TriageItem, status: TriageStatus) => {
    triageUpdate.mutate({
      id: item.id,
      runId: runId as any,
      status,
      note: noteInputs[item.id] || item.note,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between text-base">
          <span>Open Questions Triage</span>
          <Badge variant="outline">
            {totalCount - openCount}/{totalCount} resolved
          </Badge>
        </CardTitle>
        {/* Progress bar */}
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-green-500 transition-all"
            style={{ width: `${totalCount > 0 ? ((totalCount - openCount) / totalCount) * 100 : 0}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.map((item) => {
          const config = STATUS_CONFIG[item.status];
          const StatusIcon = config.icon;

          return (
            <div
              key={item.id}
              className={`rounded-lg border p-3 ${
                item.status === "open" ? "border-border" : "border-muted bg-muted/30"
              }`}
            >
              <div className="flex items-start gap-3">
                <StatusIcon className={`mt-0.5 h-4 w-4 ${config.color}`} />
                <div className="flex-1 space-y-2">
                  <p className="text-sm">{item.questionText}</p>
                  {item.note && (
                    <p className="text-xs text-muted-foreground">
                      <MessageSquare className="mr-1 inline h-3 w-3" />
                      {item.note}
                    </p>
                  )}
                  {item.status === "open" && (
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Add note..."
                        value={noteInputs[item.id] ?? ""}
                        onChange={(e) =>
                          setNoteInputs((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        className="h-7 text-xs"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleStatusChange(item, "filed")}
                        disabled={triageUpdate.isPending}
                      >
                        <FileText className="mr-1 h-3 w-3" />
                        File
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleStatusChange(item, "integrated")}
                        disabled={triageUpdate.isPending}
                      >
                        <Link className="mr-1 h-3 w-3" />
                        Integrate
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => handleStatusChange(item, "dismissed")}
                        disabled={triageUpdate.isPending}
                      >
                        <XCircle className="mr-1 h-3 w-3" />
                        Dismiss
                      </Button>
                    </div>
                  )}
                </div>
                <Badge variant="outline" className="text-xs">
                  {config.label}
                </Badge>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
