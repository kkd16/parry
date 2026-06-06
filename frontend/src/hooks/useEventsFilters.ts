import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUrlParams } from "./useUrlState";

export const PAGE_SIZE = 100;

export const TIME_OPTIONS: { value: string; label: string; ms: number }[] = [
  { value: "5m", label: "last 5 min", ms: 5 * 60 * 1000 },
  { value: "15m", label: "last 15 min", ms: 15 * 60 * 1000 },
  { value: "1h", label: "last hour", ms: 60 * 60 * 1000 },
  { value: "6h", label: "last 6 hours", ms: 6 * 60 * 60 * 1000 },
  { value: "24h", label: "last 24 hours", ms: 24 * 60 * 60 * 1000 },
  { value: "7d", label: "last 7 days", ms: 7 * 24 * 60 * 60 * 1000 },
  { value: "30d", label: "last 30 days", ms: 30 * 24 * 60 * 60 * 1000 },
];

function qs(vals: Record<string, string>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(vals)) if (v) p.set(k, v);
  return p.toString();
}

export function timeFilterCutoff(value: string): number | null {
  const opt = TIME_OPTIONS.find((o) => o.value === value);
  return opt ? Date.now() - opt.ms : null;
}

export const FILTER_KEYS = [
  "action",
  "tool",
  "workdir",
  "binary",
  "session",
  "time",
] as const;
export type FilterKey = (typeof FILTER_KEYS)[number];

const URL_KEYS = [...FILTER_KEYS, "q", "offset", "sort", "order"] as const;

export interface EventsFiltersApi {
  values: Record<FilterKey, string>;
  set: (key: FilterKey, value: string) => void;
  offset: number;
  setOffset: (n: number) => void;
  search: string;
  searchInput: string;
  onSearchChange: (v: string) => void;
  clearSearch: () => void;
  sortId: string;
  sortOrder: string;
  toggleSort: (id: string) => void;
  clearAll: () => void;
  clientFiltered: boolean;
  eventsQuery: string;
  tailQuery: (sinceId: number) => string;
  bookmarkQuery: () => string;
}

export function useEventsFilters(): EventsFiltersApi {
  const [params, setParams] = useUrlParams(URL_KEYS);
  const [searchInput, setSearchInput] = useState(params.q);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const pushedQ = useRef(params.q);

  const { action, tool, workdir, binary, session, time, q: search } = params;

  useEffect(() => {
    if (search !== pushedQ.current) {
      pushedQ.current = search;
      clearTimeout(debounceRef.current);
      setSearchInput(search);
    }
  }, [search]);
  const offset = Number(params.offset) || 0;
  const sortId = params.sort || "timestamp";
  const sortOrder = params.order || "desc";

  const set = useCallback(
    (key: FilterKey, value: string) => setParams({ [key]: value, offset: "" }),
    [setParams],
  );

  const setOffset = useCallback(
    (n: number) => setParams({ offset: n > 0 ? String(n) : "" }),
    [setParams],
  );

  const onSearchChange = useCallback(
    (v: string) => {
      setSearchInput(v);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        pushedQ.current = v;
        setParams({ q: v, offset: "" });
      }, 300);
    },
    [setParams],
  );

  const clearSearch = useCallback(() => {
    clearTimeout(debounceRef.current);
    pushedQ.current = "";
    setSearchInput("");
    setParams({ q: "", offset: "" });
  }, [setParams]);

  const toggleSort = useCallback(
    (id: string) => {
      if (sortId === id) {
        setParams({ order: sortOrder === "asc" ? "desc" : "asc", offset: "" });
      } else {
        setParams({ sort: id, order: "desc", offset: "" });
      }
    },
    [sortId, sortOrder, setParams],
  );

  const clearAll = useCallback(() => {
    clearTimeout(debounceRef.current);
    pushedQ.current = "";
    setSearchInput("");
    setParams({
      ...Object.fromEntries(FILTER_KEYS.map((k) => [k, ""])),
      q: "",
      offset: "",
    });
  }, [setParams]);

  const serverQuery = useCallback(
    (extra: Record<string, string>) =>
      qs({
        action,
        tool,
        binary,
        workdir,
        session,
        search,
        sort: sortId,
        order: sortOrder,
        ...extra,
      }),
    [action, tool, binary, workdir, session, search, sortId, sortOrder],
  );

  const eventsQuery = useMemo(
    () => serverQuery({ limit: String(PAGE_SIZE), offset: String(offset) }),
    [serverQuery, offset],
  );

  const tailQuery = useCallback(
    (sinceId: number) =>
      serverQuery({ limit: "50", since_id: String(sinceId) }),
    [serverQuery],
  );

  const bookmarkQuery = useCallback(
    () => qs({ action, tool, workdir, binary, session, time, q: search }),
    [action, tool, workdir, binary, session, time, search],
  );

  return {
    values: { action, tool, workdir, binary, session, time },
    set,
    offset,
    setOffset,
    search,
    searchInput,
    onSearchChange,
    clearSearch,
    sortId,
    sortOrder,
    toggleSort,
    clearAll,
    clientFiltered: !!time,
    eventsQuery,
    tailQuery,
    bookmarkQuery,
  };
}
