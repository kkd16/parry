import { useCallback, useEffect, useRef, useState } from "react";
import { getEvents } from "../api";
import type { Event } from "../types";

export interface EventsQueryState {
  events: Event[];
  total: number;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  freshIds: Set<number>;
}

export function useEventsQuery(opts: {
  eventsQuery: string;
  tailQuery: (sinceId: number) => string;
  autoRefresh: boolean;
  onCountChange: (n: number) => void;
  onLiveChange: (live: boolean) => void;
}): EventsQueryState {
  const { eventsQuery, tailQuery, autoRefresh, onCountChange, onLiveChange } = opts;
  const [events, setEvents] = useState<Event[]>([]);
  const [total, setTotal] = useState(0);
  const [freshIds, setFreshIds] = useState<Set<number>>(new Set());
  const tailTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const eventsRef = useRef<Event[]>([]);

  useEffect(() => {
    eventsRef.current = events;
  }, [events]);

  const [refreshNonce, setRefreshNonce] = useState(0);
  const refresh = useCallback(() => setRefreshNonce((n) => n + 1), []);

  const queryKey = `${eventsQuery}#${refreshNonce}`;
  const [fetched, setFetched] = useState<{ key: string; error: string | null }>({
    key: "",
    error: null,
  });
  const loading = fetched.key !== queryKey;
  const error = fetched.key === queryKey ? fetched.error : null;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getEvents(eventsQuery);
        if (cancelled) return;
        setEvents(data.events ?? []);
        setTotal(data.total);
        onCountChange(data.total);
        setFetched({ key: queryKey, error: null });
      } catch (e) {
        if (cancelled) return;
        setFetched({ key: queryKey, error: e instanceof Error ? e.message : "unknown error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [eventsQuery, queryKey, onCountChange]);

  const tailNewEvents = useCallback(async (signal: AbortSignal) => {
    const lastSeenId = eventsRef.current.reduce((m, e) => (e.id > m ? e.id : m), 0);
    try {
      const data = await getEvents(tailQuery(lastSeenId), signal);
      if (signal.aborted) return;
      const incoming = data.events ?? [];
      if (incoming.length === 0) return;
      setEvents((prev) => {
        const seen = new Set(prev.map((e) => e.id));
        const fresh = incoming.filter((e) => !seen.has(e.id));
        if (fresh.length === 0) return prev;
        const newIds = fresh.map((e) => e.id);
        setFreshIds((prevIds) => {
          const next = new Set(prevIds);
          for (const id of newIds) next.add(id);
          return next;
        });
        for (const id of newIds) {
          const t = setTimeout(() => {
            setFreshIds((prevIds) => {
              if (!prevIds.has(id)) return prevIds;
              const next = new Set(prevIds);
              next.delete(id);
              return next;
            });
            tailTimeoutsRef.current.delete(t);
          }, 3000);
          tailTimeoutsRef.current.add(t);
        }
        return [...fresh.reverse(), ...prev].slice(0, 500);
      });
      if (typeof data.total === "number") {
        setTotal(data.total);
        onCountChange(data.total);
      }
    } catch {
      return;
    }
  }, [tailQuery, onCountChange]);

  useEffect(() => {
    onLiveChange(autoRefresh);
    if (!autoRefresh) return;
    const ctrl = new AbortController();
    const id = setInterval(() => {
      void tailNewEvents(ctrl.signal);
    }, 3000);
    const timeouts = tailTimeoutsRef.current;
    return () => {
      ctrl.abort();
      clearInterval(id);
      for (const t of timeouts) clearTimeout(t);
      timeouts.clear();
    };
  }, [autoRefresh, tailNewEvents, onLiveChange]);

  return { events, total, loading, error, refresh, freshIds };
}
