import { useRef, type Dispatch, type SetStateAction } from "react";
import { useClickOutside } from "../../hooks/useClickOutside";
import clsx from "clsx";
import { Columns3, Download, FileJson, RefreshCw, Star } from "lucide-react";
import SearchableSelect from "../SearchableSelect";
import { Btn, inputCls } from "../ui";
import {
  TIME_OPTIONS,
  type EventsFiltersApi,
} from "../../hooks/useEventsFilters";
import { EVENT_COLUMNS, type ColumnVisibility } from "./columns";

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

const toolbarCls =
  "flex flex-wrap items-center gap-2.5 border border-rule bg-bg-raised px-3";

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

  useClickOutside(colMenuRef, colMenuOpen, () => setColMenuOpen(false));

  return (
    <>
      <div
        className={clsx(toolbarCls, "rounded-t-md border-b-rule-soft py-2.5")}
      >
        <input
          className={clsx("search-input min-w-65", inputCls)}
          type="text"
          placeholder="search entries… (press / to focus)"
          value={filters.searchInput}
          onChange={(e) => filters.onSearchChange(e.target.value)}
        />
        <select
          className={inputCls}
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
          className={inputCls}
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
          className={inputCls}
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

        <div className="flex-1" />

        <Btn
          active={autoRefresh}
          onClick={onToggleLive}
          title="auto-refresh every 3s"
        >
          <RefreshCw
            className={
              autoRefresh ? "animate-[spin_2s_linear_infinite]" : undefined
            }
          />
          live
        </Btn>
      </div>

      <div
        className={clsx(
          toolbarCls,
          "-mt-2.5 mb-4.5 rounded-b-md border-t-0 py-2",
        )}
      >
        <div className="flex-1" />
        <Btn onClick={onExportCsv}>
          <Download /> csv
        </Btn>
        <Btn onClick={onExportJson}>
          <FileJson /> json
        </Btn>
        <Btn
          onClick={onSaveBookmark}
          title="save current filters as a bookmark"
        >
          <Star /> save
        </Btn>
        <div className="relative flex items-center gap-1.5" ref={colMenuRef}>
          <Btn onClick={() => setColMenuOpen((v) => !v)}>
            <Columns3 /> cols
          </Btn>
          {colMenuOpen && (
            <div className="absolute top-full right-0 z-20 mt-1.5 min-w-40 rounded-md border border-rule bg-bg-raised px-3.5 py-2.5 shadow-panel">
              {EVENT_COLUMNS.map((col) => (
                <label
                  key={col.id}
                  className="flex cursor-pointer items-center gap-2 py-1 text-body"
                >
                  <input
                    type="checkbox"
                    className="accent-brass"
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
