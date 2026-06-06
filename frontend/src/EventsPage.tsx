import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Download, RefreshCw, Columns3, FileJson } from "lucide-react";
import SearchableSelect from "./components/SearchableSelect";
import type { Event, EventsResponse } from "./types";
import type { QuickFilter } from "./commands";
import { actionBadge } from "./policyBadges";
import EventDrawer from "./components/EventDrawer";
import PageHeader from "./components/PageHeader";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { useUrlNumber, useUrlParam } from "./hooks/useUrlState";
import { useRegisterCommands, type Command } from "./commands";
import { Eraser, RotateCcw, Star } from "lucide-react";
import EventsTimeline from "./components/EventsTimeline";
import FilterChips from "./components/FilterChips";
import { useToast } from "./components/Toasts";
import { useBookmarks } from "./hooks/useBookmarks";
import { formatAbsolute, formatRelative, useNowTick } from "./utils/relativeTime";

const PAGE_SIZE = 100;

interface Props {
  onCountChange: (n: number) => void;
  onLiveChange: (live: boolean) => void;
  pendingFilter: QuickFilter | null;
  consumePendingFilter: () => void;
  registerSearchFocus: (fn: () => void) => void;
}

type ColumnSizing = Record<string, number>;
type ColumnVisibility = Record<string, boolean>;

interface ColumnSpec {
  id: keyof Event;
  label: string;
  defaultSize: number;
  sortable: boolean;
  render: (e: Event) => ReactNode;
}

const MIN_COL_WIDTH = 60;

function shortJson(v: unknown, n = 60): string {
  const s = JSON.stringify(v) ?? "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

const TIME_OPTIONS: { value: string; label: string; ms: number }[] = [
  { value: "5m", label: "last 5 min", ms: 5 * 60 * 1000 },
  { value: "15m", label: "last 15 min", ms: 15 * 60 * 1000 },
  { value: "1h", label: "last hour", ms: 60 * 60 * 1000 },
  { value: "6h", label: "last 6 hours", ms: 6 * 60 * 60 * 1000 },
  { value: "24h", label: "last 24 hours", ms: 24 * 60 * 60 * 1000 },
  { value: "7d", label: "last 7 days", ms: 7 * 24 * 60 * 60 * 1000 },
  { value: "30d", label: "last 30 days", ms: 30 * 24 * 60 * 60 * 1000 },
];

function timeFilterCutoff(value: string): number | null {
  const opt = TIME_OPTIONS.find((o) => o.value === value);
  return opt ? Date.now() - opt.ms : null;
}

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function downloadJson(events: Event[]) {
  const blob = new Blob([JSON.stringify(events, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `parry-events-${new Date().toISOString().slice(0, 19)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadCsv(events: Event[]) {
  const cols: (keyof Event)[] = [
    "timestamp",
    "tool_name",
    "raw_name",
    "binary",
    "action",
    "mode",
    "workdir",
    "file",
    "session",
  ];
  const header = cols.join(",");
  const rows = events.map((e) =>
    cols
      .map((c) => {
        const v = e[c];
        return csvEscape(typeof v === "string" ? v : String(v ?? ""));
      })
      .join(","),
  );
  const csv = [header, ...rows, ""].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `parry-events-${new Date().toISOString().slice(0, 19)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function EventsPage({
  onCountChange,
  onLiveChange,
  pendingFilter,
  consumePendingFilter,
  registerSearchFocus,
}: Props) {
  const toast = useToast();
  const bookmarks = useBookmarks();
  const nowTick = useNowTick(30_000);
  const [density, setDensity] = useLocalStorage<"compact" | "normal" | "comfortable">(
    "parry-density",
    "normal",
  );
  const [events, setEvents] = useState<Event[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useUrlNumber("offset", 0);
  const [actionFilter, setActionFilter] = useUrlParam("action", "");
  const [toolFilter, setToolFilter] = useUrlParam("tool", "");
  const [workdirFilter, setWorkdirFilter] = useUrlParam("workdir", "");
  const [binaryFilter, setBinaryFilter] = useUrlParam("binary", "");
  const [timeFilter, setTimeFilter] = useUrlParam("time", "");
  const [search, setSearch] = useUrlParam("q", "");
  const [searchInput, setSearchInput] = useState(search);
  const [sortId, setSortId] = useUrlParam("sort", "timestamp");
  const [sortOrder, setSortOrder] = useUrlParam("order", "desc");
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
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const [selected, setSelected] = useState<Event | null>(null);
  const [freshIds, setFreshIds] = useState<Set<number>>(new Set());
  const tailTimeoutsRef = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());

  const [columnSizing, setColumnSizing] = useLocalStorage<ColumnSizing>("parry-col-sizing", {});
  const [columnVisibility, setColumnVisibility] = useLocalStorage<ColumnVisibility>(
    "parry-col-visibility",
    {
      raw_name: false,
      session: false,
    },
  );
  const [resizingId, setResizingId] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const colMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    registerSearchFocus(() => searchInputRef.current?.focus());
  }, [registerSearchFocus]);

  useEffect(() => {
    if (!pendingFilter) return;
    if (pendingFilter.kind === "action") setActionFilter(pendingFilter.value);
    if (pendingFilter.kind === "tool") setToolFilter(pendingFilter.value);
    if (pendingFilter.kind === "time") setTimeFilter(pendingFilter.value);
    setOffset(0);
    consumePendingFilter();
  }, [pendingFilter, consumePendingFilter, setActionFilter, setToolFilter, setTimeFilter, setOffset]);

  // loading/error are derived from the last completed fetch instead of set
  // imperatively, so the fetch effect never calls setState synchronously
  const [refreshNonce, setRefreshNonce] = useState(0);
  const refresh = useCallback(() => setRefreshNonce((n) => n + 1), []);

  const eventsQuery = useMemo(() => {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });
    if (actionFilter) params.set("action", actionFilter);
    if (toolFilter) params.set("tool", toolFilter);
    if (search) params.set("search", search);
    params.set("sort", sortId);
    params.set("order", sortOrder);
    return params.toString();
  }, [offset, actionFilter, toolFilter, search, sortId, sortOrder]);

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
        const res = await fetch(`/api/events?${eventsQuery}`);
        if (!res.ok) throw new Error((await res.text()) || res.statusText);
        const data: EventsResponse = await res.json();
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

  const tailNewEvents = useCallback(async () => {
    const lastSeenId = events.reduce((m, e) => (e.id > m ? e.id : m), 0);
    const params = new URLSearchParams({
      limit: "50",
      since_id: String(lastSeenId),
    });
    if (actionFilter) params.set("action", actionFilter);
    if (toolFilter) params.set("tool", toolFilter);
    if (search) params.set("search", search);
    params.set("sort", sortId);
    params.set("order", sortOrder);
    try {
      const res = await fetch(`/api/events?${params}`);
      if (!res.ok) return;
      const data: EventsResponse = await res.json();
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
      // swallow tail errors; full fetch will surface them
    }
  }, [events, actionFilter, toolFilter, search, sortId, sortOrder, onCountChange]);

  useEffect(() => {
    onLiveChange(autoRefresh);
    if (!autoRefresh) return;
    const id = setInterval(() => {
      void tailNewEvents();
    }, 3000);
    const timeouts = tailTimeoutsRef.current;
    return () => {
      clearInterval(id);
      for (const t of timeouts) clearTimeout(t);
      timeouts.clear();
    };
  }, [autoRefresh, tailNewEvents, onLiveChange]);

  useEffect(() => {
    if (!colMenuOpen) return;
    const click = (e: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) {
        setColMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", click);
    return () => document.removeEventListener("mousedown", click);
  }, [colMenuOpen]);

  const onSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setSearchInput(v);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(v);
      setOffset(0);
    }, 300);
  };

  // client-side filtering on top of server response
  const filteredEvents = useMemo(() => {
    let out = events;
    if (workdirFilter) out = out.filter((e) => e.workdir === workdirFilter);
    if (binaryFilter) out = out.filter((e) => e.binary === binaryFilter);
    const cutoff = timeFilterCutoff(timeFilter);
    if (cutoff != null) out = out.filter((e) => new Date(e.timestamp).getTime() >= cutoff);
    return out;
  }, [events, workdirFilter, binaryFilter, timeFilter]);

  const workdirs = useMemo(
    () => Array.from(new Set(events.map((e) => e.workdir).filter(Boolean))).sort(),
    [events],
  );
  const binaries = useMemo(
    () => Array.from(new Set(events.map((e) => e.binary).filter(Boolean))).sort(),
    [events],
  );

  const columns = useMemo<ColumnSpec[]>(
    () => [
      {
        id: "timestamp",
        label: "Time",
        defaultSize: 150,
        sortable: true,
        render: (e) => (
          <span className="mono" title={formatAbsolute(e.timestamp)}>
            {formatRelative(e.timestamp, nowTick)}
          </span>
        ),
      },
      {
        id: "tool_name",
        label: "Tool",
        defaultSize: 110,
        sortable: true,
        render: (e) => e.tool_name,
      },
      {
        id: "binary",
        label: "Binary",
        defaultSize: 110,
        sortable: true,
        render: (e) =>
          e.binary ? (
            <button
              className="cell-link mono"
              onClick={(ev) => {
                ev.stopPropagation();
                setBinaryFilter(e.binary);
                setOffset(0);
              }}
            >
              {e.binary}
            </button>
          ) : (
            <span className="muted">—</span>
          ),
      },
      {
        id: "file",
        label: "File",
        defaultSize: 240,
        sortable: true,
        render: (e) =>
          e.file ? <span className="mono">{e.file}</span> : <span className="muted">—</span>,
      },
      {
        id: "action",
        label: "Action",
        defaultSize: 100,
        sortable: true,
        render: (e) => actionBadge(e.action),
      },
      {
        id: "mode",
        label: "Mode",
        defaultSize: 90,
        sortable: true,
        render: (e) => e.mode,
      },
      {
        id: "workdir",
        label: "Directory",
        defaultSize: 240,
        sortable: true,
        render: (e) =>
          e.workdir ? (
            <button
              className="cell-link mono"
              onClick={(ev) => {
                ev.stopPropagation();
                setWorkdirFilter(e.workdir);
                setOffset(0);
              }}
            >
              {e.workdir}
            </button>
          ) : (
            <span className="muted">—</span>
          ),
      },
      {
        id: "tool_input",
        label: "Input",
        defaultSize: 280,
        sortable: false,
        render: (e) => <span className="mono muted">{shortJson(e.tool_input)}</span>,
      },
      {
        id: "raw_name",
        label: "Raw",
        defaultSize: 110,
        sortable: true,
        render: (e) => e.raw_name || <span className="muted">—</span>,
      },
      {
        id: "session",
        label: "Session",
        defaultSize: 100,
        sortable: false,
        render: (e) => <span className="mono">{e.session.slice(0, 8)}</span>,
      },
    ],
    [nowTick, setBinaryFilter, setWorkdirFilter, setOffset],
  );

  const visibleColumns = useMemo(
    () => columns.filter((c) => columnVisibility[c.id] !== false),
    [columns, columnVisibility],
  );
  const colWidth = useCallback(
    (c: ColumnSpec) => columnSizing[c.id] ?? c.defaultSize,
    [columnSizing],
  );
  const totalWidth = visibleColumns.reduce((sum, c) => sum + colWidth(c), 0);

  const startResize = useCallback(
    (c: ColumnSpec, startX: number) => {
      const startWidth = columnSizing[c.id] ?? c.defaultSize;
      setResizingId(c.id);
      const onMove = (ev: MouseEvent) => {
        setColumnSizing((prev) => ({
          ...prev,
          [c.id]: Math.max(MIN_COL_WIDTH, startWidth + ev.clientX - startX),
        }));
      };
      const onUp = () => {
        setResizingId(null);
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [columnSizing, setColumnSizing],
  );

  const clientFiltered = !!(workdirFilter || binaryFilter || timeFilter);
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const clearAllFilters = useCallback(() => {
    setActionFilter("");
    setToolFilter("");
    setWorkdirFilter("");
    setBinaryFilter("");
    setTimeFilter("");
    setSearch("");
    setSearchInput("");
    setOffset(0);
  }, [
    setActionFilter,
    setToolFilter,
    setWorkdirFilter,
    setBinaryFilter,
    setTimeFilter,
    setSearch,
    setOffset,
  ]);

  const eventsCommands = useMemo<Command[]>(
    () => [
      {
        id: "events.refresh",
        group: "Logbook",
        label: "Refresh logbook",
        icon: <RotateCcw />,
        keywords: ["reload", "refetch"],
        perform: refresh,
      },
      {
        id: "events.toggle-live",
        group: "Logbook",
        label: autoRefresh ? "Stop live tail" : "Start live tail",
        icon: <RefreshCw />,
        keywords: ["auto", "tail", "follow"],
        perform: () => setAutoRefresh((v) => !v),
      },
      {
        id: "events.csv",
        group: "Logbook",
        label: "Export current view as CSV",
        icon: <Download />,
        keywords: ["download", "export"],
        perform: () => downloadCsv(filteredEvents),
      },
      {
        id: "events.json",
        group: "Logbook",
        label: "Export current view as JSON",
        icon: <FileJson />,
        keywords: ["download", "export"],
        perform: () => downloadJson(filteredEvents),
      },
      {
        id: "events.columns",
        group: "Logbook",
        label: "Toggle column picker",
        icon: <Columns3 />,
        perform: () => setColMenuOpen((v) => !v),
      },
      {
        id: "events.focus-search",
        group: "Logbook",
        label: "Focus search",
        hint: "/",
        perform: () => searchInputRef.current?.focus(),
      },
      {
        id: "events.clear-filters",
        group: "Logbook",
        label: "Clear all filters",
        icon: <Eraser />,
        perform: clearAllFilters,
      },
      {
        id: "events.density.compact",
        group: "Logbook",
        label: "Density: compact",
        perform: () => setDensity("compact"),
      },
      {
        id: "events.density.normal",
        group: "Logbook",
        label: "Density: normal",
        perform: () => setDensity("normal"),
      },
      {
        id: "events.density.comfortable",
        group: "Logbook",
        label: "Density: comfortable",
        perform: () => setDensity("comfortable"),
      },
    ],
    [autoRefresh, refresh, filteredEvents, clearAllFilters, setDensity],
  );
  useRegisterCommands(eventsCommands, [eventsCommands]);

  return (
    <>
      <PageHeader
        eyebrow="instrument · 01"
        title="Logbook"
        sub={`${total.toLocaleString()} events${autoRefresh ? " · live" : ""}`}
      />

      <EventsTimeline events={filteredEvents} />

      <FilterChips
        chips={[
          ...(actionFilter
            ? [
                {
                  label: "action",
                  value: actionFilter,
                  onClear: () => {
                    setActionFilter("");
                    setOffset(0);
                  },
                },
              ]
            : []),
          ...(toolFilter
            ? [
                {
                  label: "tool",
                  value: toolFilter,
                  onClear: () => {
                    setToolFilter("");
                    setOffset(0);
                  },
                },
              ]
            : []),
          ...(workdirFilter
            ? [
                {
                  label: "dir",
                  value: workdirFilter,
                  onClear: () => setWorkdirFilter(""),
                },
              ]
            : []),
          ...(binaryFilter
            ? [
                {
                  label: "bin",
                  value: binaryFilter,
                  onClear: () => setBinaryFilter(""),
                },
              ]
            : []),
          ...(timeFilter
            ? [
                {
                  label: "time",
                  value: timeFilter,
                  onClear: () => setTimeFilter(""),
                },
              ]
            : []),
          ...(search
            ? [
                {
                  label: "search",
                  value: search,
                  onClear: () => {
                    setSearch("");
                    setSearchInput("");
                    setOffset(0);
                  },
                },
              ]
            : []),
        ]}
        onClearAll={clearAllFilters}
      />

      <div className="toolbar">
        <input
          ref={searchInputRef}
          className="input search-input"
          type="text"
          placeholder="search entries… (press / to focus)"
          value={searchInput}
          onChange={onSearch}
        />
        <select
          className="input"
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setOffset(0);
          }}
        >
          <option value="">action: all</option>
          <option value="allow">allow</option>
          <option value="confirm">confirm</option>
          <option value="block">block</option>
          <option value="observe">observe</option>
        </select>
        <select
          className="input"
          value={toolFilter}
          onChange={(e) => {
            setToolFilter(e.target.value);
            setOffset(0);
          }}
        >
          <option value="">tool: all</option>
          <option value="shell">shell</option>
          <option value="file_edit">file_edit</option>
          <option value="file_read">file_read</option>
          <option value="unknown">unknown</option>
        </select>
        <SearchableSelect
          label="dir"
          value={workdirFilter}
          options={workdirs}
          onChange={setWorkdirFilter}
        />
        <SearchableSelect
          label="bin"
          value={binaryFilter}
          options={binaries}
          onChange={setBinaryFilter}
        />
        <select
          className="input"
          value={timeFilter}
          onChange={(e) => setTimeFilter(e.target.value)}
        >
          <option value="">time: all</option>
          {TIME_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>

        <div className="toolbar-spacer" />

        <button
          className={`btn${autoRefresh ? " active" : ""}`}
          onClick={() => setAutoRefresh((v) => !v)}
          title="auto-refresh every 5s"
        >
          <RefreshCw style={{ animation: autoRefresh ? "spin 2s linear infinite" : "" }} />
          live
        </button>
      </div>

      <div className="toolbar toolbar-actions">
        <div className="toolbar-spacer" />
        <button
          className="btn"
          onClick={() => {
            downloadCsv(filteredEvents);
            toast.success("exported csv", `${filteredEvents.length} events`);
          }}
        >
          <Download /> csv
        </button>
        <button
          className="btn"
          onClick={() => {
            downloadJson(filteredEvents);
            toast.success("exported json", `${filteredEvents.length} events`);
          }}
        >
          <FileJson /> json
        </button>
        <button
          className="btn"
          onClick={() => {
            const params = new URLSearchParams();
            if (actionFilter) params.set("action", actionFilter);
            if (toolFilter) params.set("tool", toolFilter);
            if (workdirFilter) params.set("workdir", workdirFilter);
            if (binaryFilter) params.set("binary", binaryFilter);
            if (timeFilter) params.set("time", timeFilter);
            if (search) params.set("q", search);
            const bm = bookmarks.add(params.toString());
            toast.success("bookmark saved", bm.name);
          }}
          title="save current filters as a bookmark"
        >
          <Star /> save
        </button>
        <div className="toolbar-group" ref={colMenuRef} style={{ position: "relative" }}>
          <button className="btn" onClick={() => setColMenuOpen((v) => !v)}>
            <Columns3 /> cols
          </button>
          {colMenuOpen && (
            <div
              className="card"
              style={{
                position: "absolute",
                right: 0,
                top: "calc(100% + 6px)",
                zIndex: 20,
                padding: "10px 14px",
                minWidth: 160,
              }}
            >
              {columns.map((col) => (
                <label
                  key={col.id}
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    fontSize: "0.78rem",
                    padding: "4px 0",
                    cursor: "pointer",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={columnVisibility[col.id] !== false}
                    onChange={() =>
                      setColumnVisibility((prev) => ({
                        ...prev,
                        [col.id]: prev[col.id] === false,
                      }))
                    }
                    style={{ accentColor: "var(--brass)" }}
                  />
                  {col.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className={`table-wrap${loading ? " loading" : ""}`}>
        {loading && <div className="loading-bar" />}
        <table className="events-table" data-density={density} style={{ width: totalWidth }}>
          <thead>
            <tr>
              {visibleColumns.map((c) => {
                const sorted = sortId === c.id ? (sortOrder === "asc" ? "asc" : "desc") : "";
                return (
                  <th
                    key={c.id}
                    style={{ width: colWidth(c) }}
                    className={`${c.sortable ? "sortable" : ""}${sorted ? " sorted" : ""}`}
                    onClick={c.sortable ? () => toggleSort(c.id) : undefined}
                  >
                    {c.label}
                    {sorted === "asc" ? " ▲" : sorted === "desc" ? " ▼" : ""}
                    <div
                      className={`col-resizer${resizingId === c.id ? " resizing" : ""}`}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        startResize(c, e.clientX);
                      }}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {filteredEvents.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumns.length}
                  style={{
                    textAlign: "center",
                    padding: 60,
                    fontFamily: "var(--font-display)",
                    fontStyle: "italic",
                    fontSize: "1.4rem",
                    color: "var(--ink-dim)",
                  }}
                >
                  the logbook is empty.
                </td>
              </tr>
            ) : (
              filteredEvents.map((e) => (
                <tr
                  key={e.id}
                  className={`${selected?.id === e.id ? "selected" : ""}${freshIds.has(e.id) ? " is-fresh" : ""}`}
                  onClick={() => setSelected(e)}
                >
                  {visibleColumns.map((c) => (
                    <td key={c.id} style={{ width: colWidth(c) }}>
                      {c.render(e)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        <span>
          showing {filteredEvents.length}
          {clientFiltered ? " filtered" : ""} of {total.toLocaleString()}
        </span>
        {!clientFiltered && (
          <div className="pagination-controls">
            <button
              className="btn"
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
            >
              prev
            </button>
            <span>
              page {page} / {totalPages}
            </span>
            <button
              className="btn"
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              next
            </button>
          </div>
        )}
      </div>

      <EventDrawer
        key={selected?.id ?? "empty"}
        event={selected}
        onClose={() => setSelected(null)}
        onApplyFilter={(key, value) => {
          if (key === "binary") setBinaryFilter(value);
          else if (key === "workdir") setWorkdirFilter(value);
          setOffset(0);
        }}
      />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
