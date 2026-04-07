import { useEffect, useState } from "react";

export interface DashboardCounts {
  today: number | null;
  projects: number | null;
}

export function useDashboardCounts(): DashboardCounts {
  const [counts, setCounts] = useState<DashboardCounts>({ today: null, projects: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/overview");
        if (!r.ok) return;
        const data = (await r.json()) as { today?: number };
        if (!cancelled) setCounts((c) => ({ ...c, today: data.today ?? 0 }));
      } catch {
        // best-effort
      }
    })();
    (async () => {
      try {
        const r = await fetch("/api/heatmap");
        if (!r.ok) return;
        const data = (await r.json()) as { projects?: { workdir: string }[] };
        if (!cancelled) setCounts((c) => ({ ...c, projects: data.projects?.length ?? 0 }));
      } catch {
        // best-effort
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return counts;
}
