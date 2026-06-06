import { getNotifyHealth, getPolicy } from "../api";
import { useApi } from "./useApi";
import type { NotifyHealth, Policy } from "../types";

export interface PolicyOverviewState {
  policy: Policy | null;
  health: NotifyHealth | null;
  loading: boolean;
  error: string | null;
}

export function usePolicyOverview(): PolicyOverviewState {
  const policy = useApi(getPolicy);
  const health = useApi(getNotifyHealth);
  return {
    policy: policy.data,
    health: health.data,
    loading: policy.loading,
    error: policy.error,
  };
}
