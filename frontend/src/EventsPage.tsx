import { useCallback, useMemo, useState } from "react";
import type { Event } from "./types";
import EventDrawer from "./components/EventDrawer";
import EventsTimeline from "./components/EventsTimeline";
import FilterChips from "./components/FilterChips";
import PageHeader from "./components/PageHeader";
import EventsTable from "./components/events/EventsTable";
import EventsToolbar from "./components/events/EventsToolbar";
import type { ColumnSizing, ColumnVisibility } from "./components/events/columns";
import { useToast } from "./components/Toasts";
import { useBookmarks } from "./hooks/useBookmarks";
import { useEventsCommands } from "./hooks/useEventsCommands";
import {
  FILTER_KEYS,
  PAGE_SIZE,
  timeFilterCutoff,
  useEventsFilters,
  type FilterKey,
} from "./hooks/useEventsFilters";
import { useEventsQuery } from "./hooks/useEventsQuery";
import { useLocalStorage } from "./hooks/useLocalStorage";
import { downloadCsv, downloadJson } from "./utils/eventsExport";
import { useNowTick } from "./utils/relativeTime";
import "./EventsPage.css";

interface Props {
  onCountChange: (n: number) => void;
  onLiveChange: (live: boolean) => void;
}

const CHIP_LABELS: Record<FilterKey, string> = {
  action: "action",
  tool: "tool",
  workdir: "dir",
  binary: "bin",
  session: "session",
  time: "time",
};

function focusSearchInput() {
  document.querySelector<HTMLInputElement>(".search-input")?.focus();
}

export default function EventsPage({ onCountChange, onLiveChange }: Props) {
  const toast = useToast();
  const bookmarks = useBookmarks();
  const nowTick = useNowTick(30_000);
  const [density, setDensity] = useLocalStorage<"compact" | "normal" | "comfortable">(
    "parry-density",
    "normal",
  );
  const [columnSizing, setColumnSizing] = useLocalStorage<ColumnSizing>("parry-col-sizing", {});
  const [columnVisibility, setColumnVisibility] = useLocalStorage<ColumnVisibility>(
    "parry-col-visibility",
    {
      raw_name: false,
      session: false,
    },
  );
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [colMenuOpen, setColMenuOpen] = useState(false);
  const [selected, setSelected] = useState<Event | null>(null);

  const filters = useEventsFilters();
  const { events, total, loading, error, refresh, freshIds } = useEventsQuery({
    eventsQuery: filters.eventsQuery,
    tailQuery: filters.tailQuery,
    autoRefresh,
    onCountChange,
    onLiveChange,
  });

  const { workdir, time } = filters.values;
  const filteredEvents = useMemo(() => {
    let out = events;
    if (workdir) out = out.filter((e) => e.workdir === workdir);
    const cutoff = timeFilterCutoff(time);
    if (cutoff != null) out = out.filter((e) => new Date(e.timestamp).getTime() >= cutoff);
    return out;
  }, [events, workdir, time]);

  const workdirs = useMemo(
    () => Array.from(new Set(events.map((e) => e.workdir).filter(Boolean))).sort(),
    [events],
  );
  const binaries = useMemo(
    () => Array.from(new Set(events.map((e) => e.binary).filter(Boolean))).sort(),
    [events],
  );

  const exportCsv = useCallback(() => {
    downloadCsv(filteredEvents);
    toast.success("exported csv", `${filteredEvents.length} events`);
  }, [filteredEvents, toast]);
  const exportJson = useCallback(() => {
    downloadJson(filteredEvents);
    toast.success("exported json", `${filteredEvents.length} events`);
  }, [filteredEvents, toast]);
  const bookmarkQuery = filters.bookmarkQuery;
  const saveBookmark = useCallback(() => {
    const bm = bookmarks.add(bookmarkQuery());
    toast.success("bookmark saved", bm.name);
  }, [bookmarks, bookmarkQuery, toast]);

  const toggleLive = useCallback(() => setAutoRefresh((v) => !v), []);
  const toggleColumns = useCallback(() => setColMenuOpen((v) => !v), []);

  useEventsCommands({
    autoRefresh,
    onToggleLive: toggleLive,
    onRefresh: refresh,
    onExportCsv: exportCsv,
    onExportJson: exportJson,
    onToggleColumns: toggleColumns,
    onFocusSearch: focusSearchInput,
    onClearFilters: filters.clearAll,
    setDensity,
  });

  const clientFiltered = filters.clientFiltered;
  const page = Math.floor(filters.offset / PAGE_SIZE) + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const chips = [
    ...FILTER_KEYS.map((k) => ({
      label: CHIP_LABELS[k],
      value: k === "session" ? filters.values[k].slice(0, 8) : filters.values[k],
      onClear: () => filters.set(k, ""),
    })),
    { label: "search", value: filters.search, onClear: filters.clearSearch },
  ].filter((c) => c.value);

  return (
    <>
      <PageHeader
        eyebrow="instrument · 01"
        title="Logbook"
        sub={`${total.toLocaleString()} events${autoRefresh ? " · live" : ""}`}
      />

      <EventsTimeline events={filteredEvents} />

      <FilterChips chips={chips} onClearAll={filters.clearAll} />

      <EventsToolbar
        filters={filters}
        workdirs={workdirs}
        binaries={binaries}
        autoRefresh={autoRefresh}
        onToggleLive={toggleLive}
        onExportCsv={exportCsv}
        onExportJson={exportJson}
        onSaveBookmark={saveBookmark}
        colMenuOpen={colMenuOpen}
        setColMenuOpen={setColMenuOpen}
        columnVisibility={columnVisibility}
        setColumnVisibility={setColumnVisibility}
      />

      {error && <div className="error">{error}</div>}

      <EventsTable
        events={filteredEvents}
        loading={loading}
        density={density}
        nowTick={nowTick}
        selectedId={selected?.id ?? null}
        freshIds={freshIds}
        sortId={filters.sortId}
        sortOrder={filters.sortOrder}
        onToggleSort={filters.toggleSort}
        columnSizing={columnSizing}
        setColumnSizing={setColumnSizing}
        columnVisibility={columnVisibility}
        onRowClick={setSelected}
        onFilterBinary={(b) => filters.set("binary", b)}
        onFilterWorkdir={(w) => filters.set("workdir", w)}
      />

      <div className="pagination">
        <span>
          showing {filteredEvents.length}
          {clientFiltered ? " filtered" : ""} of {total.toLocaleString()}
        </span>
        {!clientFiltered && (
          <div className="pagination-controls">
            <button
              className="btn"
              disabled={filters.offset === 0}
              onClick={() => filters.setOffset(Math.max(0, filters.offset - PAGE_SIZE))}
            >
              prev
            </button>
            <span>
              page {page} / {totalPages}
            </span>
            <button
              className="btn"
              disabled={filters.offset + PAGE_SIZE >= total}
              onClick={() => filters.setOffset(filters.offset + PAGE_SIZE)}
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
        onApplyFilter={filters.set}
      />
    </>
  );
}
