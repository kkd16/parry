import { useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { Columns3, Download, FileJson, RefreshCw, Star } from "lucide-react";
import SearchableSelect from "../SearchableSelect";
import { TIME_OPTIONS, type EventsFiltersApi } from "../../hooks/useEventsFilters";
import { EVENT_COLUMNS, type ColumnVisibility } from "./columns";
import "./EventsToolbar.css";

interface Props {
  filters: EventsFiltersApi;
  workdirs: string[];
  binaries: string[];
  autoRefresh: boolean;
  onToggleLive: () => void;
  onExportCsv: () => void;
  onExportJson: () => void;
  onSaveBookmark: () => void;
  colMenuOpen: boolean;
  setColMenuOpen: Dispatch<SetStateAction<boolean>>;
  columnVisibility: ColumnVisibility;
  setColumnVisibility: (
    v: ColumnVisibility | ((prev: ColumnVisibility) => ColumnVisibility),
  ) => void;
}

export default function EventsToolbar({
  filters,
  workdirs,
  binaries,
  autoRefresh,
  onToggleLive,
  onExportCsv,
  onExportJson,
  onSaveBookmark,
  colMenuOpen,
  setColMenuOpen,
  columnVisibility,
  setColumnVisibility,
}: Props) {
  const colMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!colMenuOpen) return;
    const click = (e: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) {
        setColMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", click);
    return () => document.removeEventListener("mousedown", click);
  }, [colMenuOpen, setColMenuOpen]);

  return (
    <>
      <div className="toolbar">
        <input
          className="input search-input"
          type="text"
          placeholder="search entries… (press / to focus)"
          value={filters.searchInput}
          onChange={(e) => filters.onSearchChange(e.target.value)}
        />
        <select
          className="input"
          value={filters.values.action}
          onChange={(e) => filters.set("action", e.target.value)}
        >
          <option value="">action: all</option>
          <option value="allow">allow</option>
          <option value="confirm">confirm</option>
          <option value="block">block</option>
          <option value="observe">observe</option>
        </select>
        <select
          className="input"
          value={filters.values.tool}
          onChange={(e) => filters.set("tool", e.target.value)}
        >
          <option value="">tool: all</option>
          <option value="shell">shell</option>
          <option value="file_edit">file_edit</option>
          <option value="file_read">file_read</option>
          <option value="unknown">unknown</option>
        </select>
        <SearchableSelect
          label="dir"
          value={filters.values.workdir}
          options={workdirs}
          onChange={(v) => filters.set("workdir", v)}
        />
        <SearchableSelect
          label="bin"
          value={filters.values.binary}
          options={binaries}
          onChange={(v) => filters.set("binary", v)}
        />
        <select
          className="input"
          value={filters.values.time}
          onChange={(e) => filters.set("time", e.target.value)}
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
          onClick={onToggleLive}
          title="auto-refresh every 3s"
        >
          <RefreshCw style={{ animation: autoRefresh ? "spin 2s linear infinite" : "" }} />
          live
        </button>
      </div>

      <div className="toolbar toolbar-actions">
        <div className="toolbar-spacer" />
        <button className="btn" onClick={onExportCsv}>
          <Download /> csv
        </button>
        <button className="btn" onClick={onExportJson}>
          <FileJson /> json
        </button>
        <button className="btn" onClick={onSaveBookmark} title="save current filters as a bookmark">
          <Star /> save
        </button>
        <div className="toolbar-group" ref={colMenuRef}>
          <button className="btn" onClick={() => setColMenuOpen((v) => !v)}>
            <Columns3 /> cols
          </button>
          {colMenuOpen && (
            <div className="card col-menu">
              {EVENT_COLUMNS.map((col) => (
                <label key={col.id} className="col-menu-item">
                  <input
                    type="checkbox"
                    checked={columnVisibility[col.id] !== false}
                    onChange={() =>
                      setColumnVisibility((prev) => ({
                        ...prev,
                        [col.id]: prev[col.id] === false,
                      }))
                    }
                  />
                  {col.label}
                </label>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
