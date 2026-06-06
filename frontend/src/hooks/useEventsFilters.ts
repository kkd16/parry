import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useUrlNumber, useUrlParam } from "./useUrlState";
import type { QuickFilter } from "../commands";

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

export function timeFilterCutoff(value: string): number | null {
  const opt = TIME_OPTIONS.find((o) => o.value === value);
  return opt ? Date.now() - opt.ms : null;
}

export interface EventsFiltersApi {
  offset: number;
  setOffset: (n: number) => void;
  action: string;
  setAction: (v: string) => void;
  tool: string;
  setTool: (v: string) => void;
  workdir: string;
  setWorkdir: (v: string) => void;
  binary: string;
  setBinary: (v: string) => void;
  session: string;
  setSession: (v: string) => void;
  time: string;
  setTime: (v: string) => void;
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

export function useEventsFilters(
  pendingFilter: QuickFilter | null,
  consumePendingFilter: () => void,
): EventsFiltersApi {
  const [offset, setOffset] = useUrlNumber("offset", 0);
  const [action, setActionParam] = useUrlParam("action", "");
  const [tool, setToolParam] = useUrlParam("tool", "");
  const [workdir, setWorkdirParam] = useUrlParam("workdir", "");
  const [binary, setBinaryParam] = useUrlParam("binary", "");
  const [session, setSessionParam] = useUrlParam("session", "");
  const [time, setTimeParam] = useUrlParam("time", "");
  const [search, setSearchParam] = useUrlParam("q", "");
  const [searchInput, setSearchInput] = useState(search);
  const [sortId, setSortId] = useUrlParam("sort", "timestamp");
  const [sortOrder, setSortOrder] = useUrlParam("order", "desc");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const setAction = useCallback(
    (v: string) => {
      setActionParam(v);
      setOffset(0);
    },
    [setActionParam, setOffset],
  );
  const setTool = useCallback(
    (v: string) => {
      setToolParam(v);
      setOffset(0);
    },
    [setToolParam, setOffset],
  );
  const setWorkdir = useCallback(
    (v: string) => {
      setWorkdirParam(v);
      setOffset(0);
    },
    [setWorkdirParam, setOffset],
  );
  const setBinary = useCallback(
    (v: string) => {
      setBinaryParam(v);
      setOffset(0);
    },
    [setBinaryParam, setOffset],
  );
  const setSession = useCallback(
    (v: string) => {
      setSessionParam(v);
      setOffset(0);
    },
    [setSessionParam, setOffset],
  );
  const setTime = useCallback(
    (v: string) => {
      setTimeParam(v);
      setOffset(0);
    },
    [setTimeParam, setOffset],
  );

  const onSearchChange = useCallback(
    (v: string) => {
      setSearchInput(v);
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        setSearchParam(v);
        setOffset(0);
      }, 300);
    },
    [setSearchParam, setOffset],
  );

  const clearSearch = useCallback(() => {
    clearTimeout(debounceRef.current);
    setSearchParam("");
    setSearchInput("");
    setOffset(0);
  }, [setSearchParam, setOffset]);

  const toggleSort = useCallback(
    (id: string) => {
      if (sortId === id) {
        setSortOrder(sortOrder === "asc" ? "desc" : "asc");
      } else {
        setSortId(id);
        setSortOrder("desc");
      }
      setOffset(0);
    },
    [sortId, sortOrder, setSortId, setSortOrder, setOffset],
  );

  const clearAll = useCallback(() => {
    clearTimeout(debounceRef.current);
    setActionParam("");
    setToolParam("");
    setWorkdirParam("");
    setBinaryParam("");
    setSessionParam("");
    setTimeParam("");
    setSearchParam("");
    setSearchInput("");
    setOffset(0);
  }, [
    setActionParam,
    setToolParam,
    setWorkdirParam,
    setBinaryParam,
    setSessionParam,
    setTimeParam,
    setSearchParam,
    setOffset,
  ]);

  useEffect(() => {
    if (!pendingFilter) return;
    if (pendingFilter.kind === "action") setAction(pendingFilter.value);
    if (pendingFilter.kind === "tool") setTool(pendingFilter.value);
    if (pendingFilter.kind === "time") setTime(pendingFilter.value);
    consumePendingFilter();
  }, [pendingFilter, consumePendingFilter, setAction, setTool, setTime]);

  const serverParams = useCallback(() => {
    const params = new URLSearchParams();
    if (action) params.set("action", action);
    if (tool) params.set("tool", tool);
    if (binary) params.set("binary", binary);
    if (session) params.set("session", session);
    if (search) params.set("search", search);
    params.set("sort", sortId);
    params.set("order", sortOrder);
    return params;
  }, [action, tool, binary, session, search, sortId, sortOrder]);

  const eventsQuery = useMemo(() => {
    const params = serverParams();
    params.set("limit", String(PAGE_SIZE));
    params.set("offset", String(offset));
    return params.toString();
  }, [serverParams, offset]);

  const tailQuery = useCallback(
    (sinceId: number) => {
      const params = serverParams();
      params.set("limit", "50");
      params.set("since_id", String(sinceId));
      return params.toString();
    },
    [serverParams],
  );

  const bookmarkQuery = useCallback(() => {
    const params = new URLSearchParams();
    if (action) params.set("action", action);
    if (tool) params.set("tool", tool);
    if (workdir) params.set("workdir", workdir);
    if (binary) params.set("binary", binary);
    if (session) params.set("session", session);
    if (time) params.set("time", time);
    if (search) params.set("q", search);
    return params.toString();
  }, [action, tool, workdir, binary, session, time, search]);

  return {
    offset,
    setOffset,
    action,
    setAction,
    tool,
    setTool,
    workdir,
    setWorkdir,
    binary,
    setBinary,
    session,
    setSession,
    time,
    setTime,
    search,
    searchInput,
    onSearchChange,
    clearSearch,
    sortId,
    sortOrder,
    toggleSort,
    clearAll,
    clientFiltered: !!(workdir || time),
    eventsQuery,
    tailQuery,
    bookmarkQuery,
  };
}
