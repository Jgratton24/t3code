/**
 * DiscoveryLogViewer - Terminal-style live log viewer for agent output.
 *
 * Displays streaming log chunks in a monospace dark terminal view
 * with auto-scrolling.
 */
import { useRef, useEffect, useState } from "react";
import type { DiscoveryAgentStatus } from "@t3tools/contracts";

import { useDiscoveryStore } from "~/store/discoveryStore";

interface DiscoveryLogViewerProps {
  runId: string;
  agents: readonly DiscoveryAgentStatus[];
}

export function DiscoveryLogViewer({ runId, agents }: DiscoveryLogViewerProps) {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(
    agents[0]?.agent ?? null,
  );
  const logBuffers = useDiscoveryStore((s) => s.agentLogBuffers);
  const containerRef = useRef<HTMLDivElement>(null);

  const key = selectedAgent ? `${runId}:${selectedAgent}` : "";
  const logLines = key ? (logBuffers[key] ?? []) : [];

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [logLines.length]);

  return (
    <div className="space-y-2">
      {/* Agent selector */}
      {agents.length > 1 && (
        <div className="flex gap-1">
          {agents.map((agent) => (
            <button
              key={agent.agent}
              onClick={() => setSelectedAgent(agent.agent)}
              className={`rounded-md px-2 py-1 text-xs font-medium transition-colors ${
                selectedAgent === agent.agent
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="capitalize">{agent.agent}</span>
            </button>
          ))}
        </div>
      )}

      {/* Log viewer */}
      <div
        ref={containerRef}
        className="h-64 overflow-y-auto rounded-lg bg-zinc-950 p-3 font-mono text-xs text-zinc-300"
      >
        {logLines.length > 0 ? (
          logLines.map((line, i) => (
            <div key={i} className="whitespace-pre-wrap break-all">
              {line}
            </div>
          ))
        ) : (
          <span className="text-zinc-600">Waiting for agent output...</span>
        )}
      </div>
    </div>
  );
}
