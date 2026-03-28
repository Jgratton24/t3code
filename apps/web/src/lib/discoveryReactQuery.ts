/**
 * Discovery React Query option factories.
 *
 * Provides typed query/mutation options for all discovery API endpoints.
 */
import { queryOptions, type QueryClient } from "@tanstack/react-query";
import type {
  DiscoveryRunConfig,
  DiscoveryScheduleConfig,
  DiscoveryProjectConfig,
  TriageUpdateInput,
} from "@t3tools/contracts";
import { ensureNativeApi } from "~/nativeApi";

// ── Query Keys ──────────────────────────────────────────────────────

export const discoveryQueryKeys = {
  all: ["discovery"] as const,
  runs: () => ["discovery", "runs"] as const,
  runList: (limit?: number, offset?: number) =>
    ["discovery", "runs", "list", limit ?? 20, offset ?? 0] as const,
  runStatus: (runId: string) => ["discovery", "runs", "status", runId] as const,
  report: (runId: string) => ["discovery", "report", runId] as const,
  agentHealth: () => ["discovery", "agentHealth"] as const,
  schedule: () => ["discovery", "schedule"] as const,
  triage: (runId: string) => ["discovery", "triage", runId] as const,
  config: () => ["discovery", "config"] as const,
};

// ── Query Options ───────────────────────────────────────────────────

export function discoveryRunListQueryOptions(limit?: number, offset?: number) {
  return queryOptions({
    queryKey: discoveryQueryKeys.runList(limit, offset),
    queryFn: async () => {
      const api = ensureNativeApi();
      return api.discovery.listRuns({
        ...(limit !== undefined ? { limit } : {}),
        ...(offset !== undefined ? { offset } : {}),
      });
    },
    staleTime: 10_000,
    refetchInterval: 30_000,
  });
}

export function discoveryRunStatusQueryOptions(runId: string) {
  return queryOptions({
    queryKey: discoveryQueryKeys.runStatus(runId),
    queryFn: async () => {
      const api = ensureNativeApi();
      return api.discovery.getRunStatus(runId);
    },
    staleTime: 2_000,
    refetchInterval: 5_000,
    enabled: Boolean(runId),
  });
}

export function discoveryReportQueryOptions(runId: string) {
  return queryOptions({
    queryKey: discoveryQueryKeys.report(runId),
    queryFn: async () => {
      const api = ensureNativeApi();
      return api.discovery.getReport(runId);
    },
    staleTime: Infinity, // Reports are immutable once created
    enabled: Boolean(runId),
  });
}

export function discoveryAgentHealthQueryOptions() {
  return queryOptions({
    queryKey: discoveryQueryKeys.agentHealth(),
    queryFn: async () => {
      const api = ensureNativeApi();
      return api.discovery.getAgentHealth();
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });
}

export function discoveryScheduleQueryOptions() {
  return queryOptions({
    queryKey: discoveryQueryKeys.schedule(),
    queryFn: async () => {
      const api = ensureNativeApi();
      return api.discovery.getSchedule();
    },
    staleTime: 30_000,
  });
}

export function discoveryTriageListQueryOptions(runId: string) {
  return queryOptions({
    queryKey: discoveryQueryKeys.triage(runId),
    queryFn: async () => {
      const api = ensureNativeApi();
      return api.discovery.triageList(runId);
    },
    staleTime: 10_000,
    enabled: Boolean(runId),
  });
}

export function discoveryConfigQueryOptions() {
  return queryOptions({
    queryKey: discoveryQueryKeys.config(),
    queryFn: async () => {
      const api = ensureNativeApi();
      return api.discovery.getConfig();
    },
    staleTime: 60_000,
  });
}

// ── Mutation Helpers ────────────────────────────────────────────────

export function discoveryStartRunMutation(queryClient: QueryClient) {
  return {
    mutationFn: async (config: DiscoveryRunConfig) => {
      const api = ensureNativeApi();
      return api.discovery.startRun(config);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: discoveryQueryKeys.runs() });
    },
  };
}

export function discoveryCancelRunMutation(queryClient: QueryClient) {
  return {
    mutationFn: async (runId: string) => {
      const api = ensureNativeApi();
      return api.discovery.cancelRun(runId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: discoveryQueryKeys.runs() });
    },
  };
}

export function discoveryResetCooldownMutation(queryClient: QueryClient) {
  return {
    mutationFn: async (agent: string) => {
      const api = ensureNativeApi();
      return api.discovery.resetAgentCooldown(agent);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: discoveryQueryKeys.agentHealth() });
    },
  };
}

export function discoveryUpdateScheduleMutation(queryClient: QueryClient) {
  return {
    mutationFn: async (config: DiscoveryScheduleConfig) => {
      const api = ensureNativeApi();
      return api.discovery.updateSchedule(config);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: discoveryQueryKeys.schedule() });
    },
  };
}

export function discoveryTriageUpdateMutation(queryClient: QueryClient) {
  return {
    mutationFn: async (input: TriageUpdateInput) => {
      const api = ensureNativeApi();
      return api.discovery.triageUpdate(input);
    },
    onSuccess: (_data: void, variables: TriageUpdateInput) => {
      queryClient.invalidateQueries({
        queryKey: discoveryQueryKeys.triage(variables.runId),
      });
    },
  };
}

export function discoveryUpdateConfigMutation(queryClient: QueryClient) {
  return {
    mutationFn: async (config: DiscoveryProjectConfig) => {
      const api = ensureNativeApi();
      return api.discovery.updateConfig(config);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: discoveryQueryKeys.config() });
    },
  };
}
