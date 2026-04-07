import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type ColumnDef,
  type ColumnOrderState,
  type ColumnSizingState,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
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
import { Eraser, RotateCcw } from "lucide-react";
import EventsTimeline from "./components/EventsTimeline";
import FilterChips from "./components/FilterChips";
import { useToast } from "./components/Toasts";

const PAGE_SIZE = 100;

interface Props {
  onCountChange: (n: number) => void;
  onLiveChange: (live: boolean) => void;
  pendingFilter: QuickFilter | null;
  consumePendingFilter: () => void;
  registerSearchFocus: (fn: () => void) => void;
}

const COLUMN_LABELS: Record<string, string> = {
  timestamp: "Time",
  raw_name: "Raw",
  tool_name: "Tool",
  binary: "Binary",
  subcommand: "Subcmd",
  action: "Action",
  mode: "Mode",
  workdir: "Directory",
  session: "Session",
  file: "File",
  tool_input: "Input",
};

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
    "subcommand",
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
  const sorting: SortingState = useMemo(
    () => [{ id: sortId, desc: sortOrder !== "asc" }],
    [sortId, sortOrder],
  );
  const setSorting = useCallback(
    (updater: SortingState | ((old: SortingState) => SortingState)) => {
      const next = typeof updater === "function" ? updater(sorting) : updater;
      const first = next[0];
      if (!first) {
        setSortId("timestamp");
        setSortOrder("desc");
        return;
      }
      setSortId(first.id);
      setSortOrder(first.desc ? "desc" : "asc");
    },
    [sorting, setSortId, setSortOrder],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const [selected, setSelected] = useState<Event | null>(null);

  const [columnSizing, setColumnSizing] = useLocalStorage<ColumnSizingState>(
    "parry-col-sizing",
    {},
  );
  const [columnOrder, setColumnOrder] = useLocalStorage<ColumnOrderState>("parry-col-order", [
    "timestamp",
    "tool_name",
    "binary",
    "file",
    "action",
    "mode",
    "workdir",
    "tool_input",
  ]);
  const [columnVisibility, setColumnVisibility] = useLocalStorage<VisibilityState>(
    "parry-col-visibility",
    {
      raw_name: false,
      subcommand: false,
      session: false,
    },
  );

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

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });
    if (actionFilter) params.set("action", actionFilter);
    if (toolFilter) params.set("tool", toolFilter);
    if (search) params.set("search", search);
    const sort = sorting[0];
    if (sort) {
      params.set("sort", sort.id);
      params.set("order", sort.desc ? "desc" : "asc");
    }
    try {
      const res = await fetch(`/api/events?${params}`);
      if (!res.ok) throw new Error((await res.text()) || res.statusText);
      const data: EventsResponse = await res.json();
      setEvents(data.events ?? []);
      setTotal(data.total);
      onCountChange(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "unknown error");
    } finally {
      setLoading(false);
    }
  }, [offset, actionFilter, toolFilter, search, sorting, onCountChange]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    onLiveChange(autoRefresh);
    if (!autoRefresh) return;
    const id = setInterval(fetchEvents, 5000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchEvents, onLiveChange]);

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

  const columns = useMemo<ColumnDef<Event>[]>(
    () => [
      {
        accessorKey: "timestamp",
        header: "Time",
        size: 170,
        cell: (c) => <span className="mono">{new Date(c.getValue<string>()).toLocaleString()}</span>,
      },
      {
        accessorKey: "raw_name",
        header: "Raw",
        size: 110,
        cell: (c) => c.getValue<string>() || <span className="muted">—</span>,
      },
      {
        accessorKey: "tool_name",
        header: "Tool",
        size: 110,
      },
      {
        accessorKey: "binary",
        header: "Binary",
        size: 110,
        cell: (c) => {
          const v = c.getValue<string>();
          return v ? <span className="mono">{v}</span> : <span className="muted">—</span>;
        },
      },
      {
        accessorKey: "subcommand",
        header: "Subcmd",
        size: 110,
        cell: (c) => {
          const v = c.getValue<string>();
          return v ? <span className="mono">{v}</span> : <span className="muted">—</span>;
        },
      },
      {
        accessorKey: "action",
        header: "Action",
        size: 100,
        cell: (c) => actionBadge(c.getValue<string>()),
      },
      {
        accessorKey: "mode",
        header: "Mode",
        size: 90,
      },
      {
        accessorKey: "workdir",
        header: "Directory",
        size: 240,
        cell: (c) => {
          const v = c.getValue<string>();
          return v ? <span className="mono">{v}</span> : <span className="muted">—</span>;
        },
      },
      {
        accessorKey: "session",
        header: "Session",
        size: 100,
        enableSorting: false,
        cell: (c) => <span className="mono">{c.getValue<string>().slice(0, 8)}</span>,
      },
      {
        accessorKey: "file",
        header: "File",
        size: 240,
        cell: (c) => {
          const v = c.getValue<string>();
          return v ? <span className="mono">{v}</span> : <span className="muted">—</span>;
        },
      },
      {
        accessorKey: "tool_input",
        header: "Input",
        size: 280,
        enableSorting: false,
        cell: (c) => <span className="mono muted">{shortJson(c.getValue())}</span>,
      },
    ],
    [],
  );

  const table = useReactTable({
    data: filteredEvents,
    columns,
    state: { sorting, columnSizing, columnOrder, columnVisibility },
    onSortingChange: setSorting,
    onColumnSizingChange: setColumnSizing,
    onColumnOrderChange: setColumnOrder,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: "onChange",
    manualSorting: true,
    enableColumnResizing: true,
  });

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
        perform: () => fetchEvents(),
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
    ],
    [autoRefresh, fetchEvents, filteredEvents, clearAllFilters],
  );
  useRegisterCommands(eventsCommands, [eventsCommands]);

  return (
    <>
      <PageHeader
        eyebrow="instrument · 01"
        title="Logbook"
        sub={`${total.toLocaleString()} entries observed${autoRefresh ? " · live" : ""}`}
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
              {table.getAllLeafColumns().map((col) => (
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
                    checked={col.getIsVisible()}
                    onChange={col.getToggleVisibilityHandler()}
                    style={{ accentColor: "var(--brass)" }}
                  />
                  {COLUMN_LABELS[col.id] ?? col.id}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className={`table-wrap${loading ? " loading" : ""}`}>
        {loading && <div className="loading-bar" />}
        <table className="events-table" style={{ width: table.getCenterTotalSize() }}>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => {
                  const sortable = h.column.getCanSort();
                  const sorted = h.column.getIsSorted();
                  return (
                    <th
                      key={h.id}
                      style={{ width: h.getSize() }}
                      className={`${sortable ? "sortable" : ""}${sorted ? " sorted" : ""}`}
                      onClick={
                        sortable
                          ? () => {
                              h.column.toggleSorting(sorted === "asc");
                              setOffset(0);
                            }
                          : undefined
                      }
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {sorted === "asc" ? " ▲" : sorted === "desc" ? " ▼" : ""}
                      {h.column.getCanResize() && (
                        <div
                          onMouseDown={h.getResizeHandler()}
                          onTouchStart={h.getResizeHandler()}
                          onClick={(e) => e.stopPropagation()}
                          className={`col-resizer${h.column.getIsResizing() ? " resizing" : ""}`}
                        />
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={table.getAllLeafColumns().length}
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
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={selected?.id === row.original.id ? "selected" : ""}
                  onClick={() => setSelected(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} style={{ width: cell.column.getSize() }}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
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

      <EventDrawer event={selected} onClose={() => setSelected(null)} />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
