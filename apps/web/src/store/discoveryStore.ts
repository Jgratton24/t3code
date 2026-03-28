/**
 * Discovery Zustand store - manages real-time discovery state.
 *
 * Separated from the main AppState to keep concerns isolated.
 * Handles live run status, agent log streaming, and sidebar badges.
 */
import type {
  AgentHealthEntry,
  DiscoveryRunStatus,
  DiscoveryRunSummary,
} from "@t3tools/contracts";
import { create } from "zustand";

export interface DiscoveryState {
  /** Currently active run ID (null when no run is executing) */
  activeRunId: string | null;

  /** Live status of the active run (pushed via WebSocket) */
  activeRunStatus: DiscoveryRunStatus | null;

  /** Agent health entries */
  agentHealth: AgentHealthEntry[];

  /** Live agent log buffers: keyed by "runId:agent" */
  agentLogBuffers: Record<string, string[]>;

  /** Last run ID the user has viewed */
  lastViewedRunId: string | null;

  /** Whether there's a completed run the user hasn't viewed yet */
  hasUnviewedCompletedRun: boolean;
}

export interface DiscoveryActions {
  /** Update active run status from WebSocket push */
  setRunStatus: (status: DiscoveryRunStatus) => void;

  /** Handle run completion */
  onRunCompleted: (summary: DiscoveryRunSummary) => void;

  /** Append a log chunk for an agent */
  appendLogChunk: (runId: string, agent: string, chunk: string) => void;

  /** Update agent health */
  setAgentHealth: (health: AgentHealthEntry[]) => void;

  /** Mark a run as viewed */
  markRunViewed: (runId: string) => void;

  /** Clear the active run */
  clearActiveRun: () => void;
}

export const useDiscoveryStore = create<DiscoveryState & DiscoveryActions>()((set) => ({
  // State
  activeRunId: null,
  activeRunStatus: null,
  agentHealth: [],
  agentLogBuffers: {},
  lastViewedRunId: null,
  hasUnviewedCompletedRun: false,

  // Actions
  setRunStatus: (status) =>
    set((state) => ({
      activeRunId: status.runId,
      activeRunStatus: status,
      // Clear active run if terminal phase
      ...(status.phase === "completed" || status.phase === "failed" || status.phase === "cancelled"
        ? { activeRunId: null }
        : {}),
    })),

  onRunCompleted: (summary) =>
    set((state) => ({
      activeRunId: null,
      activeRunStatus: null,
      hasUnviewedCompletedRun: state.lastViewedRunId !== summary.runId,
    })),

  appendLogChunk: (runId, agent, chunk) =>
    set((state) => {
      const key = `${runId}:${agent}`;
      const existing = state.agentLogBuffers[key] ?? [];
      // Cap log buffer at 10000 lines to prevent memory issues
      const updated = [...existing, chunk].slice(-10000);
      return {
        agentLogBuffers: { ...state.agentLogBuffers, [key]: updated },
      };
    }),

  setAgentHealth: (health) => set({ agentHealth: health }),

  markRunViewed: (runId) =>
    set({
      lastViewedRunId: runId,
      hasUnviewedCompletedRun: false,
    }),

  clearActiveRun: () =>
    set({
      activeRunId: null,
      activeRunStatus: null,
    }),
}));
