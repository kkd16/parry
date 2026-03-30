import { useEffect, useState } from "react";
import type { NotifyHealth, Policy } from "./types";

export interface PolicyOverviewState {
  policy: Policy | null;
  health: NotifyHealth | null;
  loading: boolean;
  error: string | null;
}

export function usePolicyOverview(): PolicyOverviewState {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [health, setHealth] = useState<NotifyHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/policy");
        if (!res.ok) throw new Error(await res.text());
        const data: Policy = await res.json();
        if (!cancelled) setPolicy(data);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    (async () => {
      try {
        const res = await fetch("/api/notify/health");
        if (res.ok) {
          const data: NotifyHealth = await res.json();
          if (!cancelled) setHealth(data);
        }
      } catch {
        // health check is best-effort
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { policy, health, loading, error };
}
