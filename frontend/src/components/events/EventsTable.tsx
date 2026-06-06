import { useCallback, useMemo, useState } from "react";
import type { Event } from "../../types";
import {
  EVENT_COLUMNS,
  MIN_COL_WIDTH,
  type ColumnCtx,
  type ColumnSizing,
  type ColumnSpec,
  type ColumnVisibility,
} from "./columns";
import "./EventsTable.css";

interface Props {
  events: Event[];
  loading: boolean;
  density: string;
  nowTick: number;
  selectedId: number | null;
  freshIds: Set<number>;
  sortId: string;
  sortOrder: string;
  onToggleSort: (id: string) => void;
  columnSizing: ColumnSizing;
  setColumnSizing: (v: ColumnSizing | ((prev: ColumnSizing) => ColumnSizing)) => void;
  columnVisibility: ColumnVisibility;
  onRowClick: (e: Event) => void;
  onFilterBinary: (b: string) => void;
  onFilterWorkdir: (w: string) => void;
}

export default function EventsTable({
  events,
  loading,
  density,
  nowTick,
  selectedId,
  freshIds,
  sortId,
  sortOrder,
  onToggleSort,
  columnSizing,
  setColumnSizing,
  columnVisibility,
  onRowClick,
  onFilterBinary,
  onFilterWorkdir,
}: Props) {
  const [resizingId, setResizingId] = useState<string | null>(null);

  const ctx = useMemo<ColumnCtx>(
    () => ({ nowTick, onFilterBinary, onFilterWorkdir }),
    [nowTick, onFilterBinary, onFilterWorkdir],
  );

  const visibleColumns = useMemo(
    () => EVENT_COLUMNS.filter((c) => columnVisibility[c.id] !== false),
    [columnVisibility],
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

  return (
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
                  onClick={c.sortable ? () => onToggleSort(c.id) : undefined}
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
          {events.length === 0 ? (
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
            events.map((e) => (
              <tr
                key={e.id}
                className={`${selectedId === e.id ? "selected" : ""}${freshIds.has(e.id) ? " is-fresh" : ""}`}
                onClick={() => onRowClick(e)}
              >
                {visibleColumns.map((c) => (
                  <td key={c.id} style={{ width: colWidth(c) }}>
                    {c.render(e, ctx)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
