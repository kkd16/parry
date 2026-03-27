import { useEffect, useState, useCallback, useRef } from "react";
import type { Event, EventsResponse } from "./types";

const PAGE_SIZE = 100;

type ColKey =
  | "timestamp"
  | "raw_name"
  | "tool_name"
  | "binary"
  | "subcommand"
  | "action"
  | "tier"
  | "mode"
  | "session"
  | "workdir"
  | "file"
  | "tool_input";

type SortCol = ColKey | "";

interface ColDef {
  key: ColKey;
  label: string;
  sortable: boolean;
}

const ALL_COLUMNS: ColDef[] = [
  { key: "timestamp", label: "Time", sortable: true },
  { key: "raw_name", label: "Raw Tool", sortable: true },
  { key: "tool_name", label: "Tool", sortable: true },
  { key: "binary", label: "Binary", sortable: true },
  { key: "subcommand", label: "Subcmd", sortable: true },
  { key: "action", label: "Action", sortable: true },
  { key: "tier", label: "Tier", sortable: true },
  { key: "mode", label: "Mode", sortable: true },
  { key: "workdir", label: "Directory", sortable: true },
  { key: "session", label: "Session", sortable: false },
  { key: "file", label: "File", sortable: true },
  { key: "tool_input", label: "Input", sortable: false },
];

const DEFAULT_VISIBLE: ColKey[] = [
  "timestamp",
  "tool_name",
  "binary",
  "file",
  "action",
  "tier",
  "mode",
  "workdir",
];

const STORAGE_KEY = "parry-columns";

function loadVisibleCols(): ColKey[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored) as ColKey[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {}
  return DEFAULT_VISIBLE;
}

function actionClass(action: string): string {
  switch (action) {
    case "allow":
      return "badge badge-allow";
    case "block":
      return "badge badge-block";
    case "observe":
      return "badge badge-observe";
    default:
      return "badge";
  }
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString();
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 3) + "..." : s;
}

function sortIndicator(col: SortCol, activeCol: SortCol, order: "asc" | "desc"): string {
  if (col !== activeCol) return "";
  return order === "asc" ? " \u25B2" : " \u25BC";
}

function renderCell(ev: Event, col: ColKey): React.ReactNode {
  switch (col) {
    case "timestamp":
      return <span className="nowrap">{formatTime(ev.timestamp)}</span>;
    case "raw_name":
      return ev.raw_name;
    case "tool_name":
      return ev.tool_name;
    case "binary":
      return ev.binary ? <span className="mono">{ev.binary}</span> : <span className="muted">-</span>;
    case "subcommand":
      return ev.subcommand ? <span className="mono">{ev.subcommand}</span> : <span className="muted">-</span>;
    case "action":
      return <span className={actionClass(ev.action)}>{ev.action}</span>;
    case "tier":
      return <span className="center">T{ev.tier}</span>;
    case "mode":
      return ev.mode;
    case "workdir":
      return ev.workdir ? <span className="mono">{ev.workdir}</span> : <span className="muted">-</span>;
    case "file":
      return ev.file ? <span className="mono">{ev.file}</span> : <span className="muted">-</span>;
    case "session":
      return <span className="mono">{ev.session.slice(0, 8)}</span>;
    case "tool_input":
      return (
        <span className="input-cell" title={JSON.stringify(ev.tool_input)}>
          {truncate(JSON.stringify(ev.tool_input), 60)}
        </span>
      );
  }
}

export default function App() {
  const [events, setEvents] = useState<Event[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [actionFilter, setActionFilter] = useState("");
  const [toolFilter, setToolFilter] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState<SortCol>("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visibleCols, setVisibleCols] = useState<ColKey[]>(loadVisibleCols);
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const colMenuRef = useRef<HTMLDivElement>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });
    if (actionFilter) params.set("action", actionFilter);
    if (toolFilter) params.set("tool", toolFilter);
    if (tierFilter) params.set("tier", tierFilter);
    if (search) params.set("search", search);
    if (sortCol) {
      params.set("sort", sortCol);
      params.set("order", sortOrder);
    }

    try {
      const res = await fetch(`/api/events?${params}`);
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || res.statusText);
      }
      const data: EventsResponse = await res.json();
      setEvents(data.events ?? []);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [offset, actionFilter, toolFilter, tierFilter, search, sortCol, sortOrder]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    if (!colMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) {
        setColMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [colMenuOpen]);

  const handleFilterChange = (setter: (v: string) => void) => {
    return (e: React.ChangeEvent<HTMLSelectElement>) => {
      setter(e.target.value);
      setOffset(0);
    };
  };

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchInput(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSearch(val);
      setOffset(0);
    }, 300);
  };

  const handleSort = (col: ColKey) => {
    const def = ALL_COLUMNS.find((c) => c.key === col);
    if (!def?.sortable) return;
    if (sortCol === col) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortCol(col);
      setSortOrder("desc");
    }
    setOffset(0);
  };

  const toggleCol = (key: ColKey) => {
    const next = visibleCols.includes(key)
      ? visibleCols.filter((c) => c !== key)
      : [...visibleCols, key];
    if (next.length === 0) return;
    setVisibleCols(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    if (sortCol === key && !next.includes(key)) {
      setSortCol("");
    }
  };

  const activeCols = ALL_COLUMNS.filter((c) => visibleCols.includes(c.key));
  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="container">
      <header>
        <h1>Parry Dashboard</h1>
        <span className="total">{total} events</span>
      </header>

      <div className="filters">
        <input
          type="text"
          className="search-input"
          placeholder="Search events..."
          value={searchInput}
          onChange={handleSearchInput}
        />
        <label>
          Action:
          <select value={actionFilter} onChange={handleFilterChange(setActionFilter)}>
            <option value="">All</option>
            <option value="allow">Allow</option>
            <option value="block">Block</option>
            <option value="observe">Observe</option>
          </select>
        </label>
        <label>
          Tool:
          <select value={toolFilter} onChange={handleFilterChange(setToolFilter)}>
            <option value="">All</option>
            <option value="shell">Shell</option>
            <option value="file_edit">File Edit</option>
            <option value="file_read">File Read</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
        <label>
          Tier:
          <select value={tierFilter} onChange={handleFilterChange(setTierFilter)}>
            <option value="">All</option>
            <option value="1">T1</option>
            <option value="2">T2</option>
            <option value="3">T3</option>
            <option value="4">T4</option>
            <option value="5">T5</option>
          </select>
        </label>
        <div className="col-toggle" ref={colMenuRef}>
          <button className="col-toggle-btn" onClick={() => setColMenuOpen(!colMenuOpen)}>
            Columns
          </button>
          {colMenuOpen && (
            <div className="col-dropdown">
              {ALL_COLUMNS.map(({ key, label }) => (
                <label key={key} className="col-option">
                  <input
                    type="checkbox"
                    checked={visibleCols.includes(key)}
                    onChange={() => toggleCol(key)}
                  />
                  {label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      {error && <div className="error">{error}</div>}

      <div className={`table-wrap${loading ? " table-loading" : ""}`}>
        {loading && <div className="loading-bar" />}
        <table>
          <thead>
            <tr>
              {activeCols.map(({ key, label, sortable }) => (
                <th
                  key={key}
                  className={sortable ? "sortable" : undefined}
                  onClick={sortable ? () => handleSort(key) : undefined}
                >
                  {label}{sortable ? sortIndicator(key, sortCol, sortOrder) : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={activeCols.length} className="empty">
                  No events found
                </td>
              </tr>
            ) : (
              events.map((ev) => (
                <tr key={ev.id}>
                  {activeCols.map(({ key }) => (
                    <td key={key}>{renderCell(ev, key)}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="pagination">
        {totalPages > 1 ? (
          <>
            <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
              Prev
            </button>
            <span>
              Page {page} of {totalPages}
            </span>
            <button
              disabled={offset + PAGE_SIZE >= total}
              onClick={() => setOffset(offset + PAGE_SIZE)}
            >
              Next
            </button>
          </>
        ) : (
          <span>&nbsp;</span>
        )}
      </div>
    </div>
  );
}
