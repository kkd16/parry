import { useCallback, useMemo, useState } from "react";
import clsx from "clsx";
import type { Event } from "../../types";
import {
  EVENT_COLUMNS,
  MIN_COL_WIDTH,
  type ColumnCtx,
  type ColumnSizing,
  type ColumnSpec,
  type ColumnVisibility,
} from "./columns";

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
  setColumnSizing: (
    v: ColumnSizing | ((prev: ColumnSizing) => ColumnSizing),
  ) => void;
  columnVisibility: ColumnVisibility;
  onRowClick: (e: Event) => void;
  onFilterBinary: (b: string) => void;
  onFilterWorkdir: (w: string) => void;
}

const tdByDensity: Record<string, string> = {
  compact: "px-3 py-1 text-meta",
  normal: "px-3 py-2",
  comfortable: "px-3.5 py-3",
};

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
  const tdCls = clsx(
    "truncate text-ink",
    tdByDensity[density] ?? tdByDensity.normal,
  );

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
    <div
      className={clsx(
        "relative overflow-x-auto overflow-y-hidden rounded-md border border-rule bg-bg-raised",
        loading && "opacity-55 transition-opacity duration-200",
      )}
    >
      {loading && (
        <div className="absolute inset-x-0 top-0 z-2 h-0.5 animate-loading-slide bg-brass" />
      )}
      <table
        className="w-full table-fixed border-separate border-spacing-0 text-body"
        style={{ width: totalWidth }}
      >
        <thead>
          <tr>
            {visibleColumns.map((c) => {
              const sorted =
                sortId === c.id ? (sortOrder === "asc" ? "asc" : "desc") : "";
              return (
                <th
                  key={c.id}
                  style={{ width: colWidth(c) }}
                  className={clsx(
                    "sticky top-0 z-1 border-b border-rule bg-bg-raised px-3 py-2.5 text-left text-micro font-semibold tracking-label text-ink-mute uppercase select-none",
                    c.sortable && "cursor-pointer hover:text-brass",
                    sorted && "text-brass",
                  )}
                  onClick={c.sortable ? () => onToggleSort(c.id) : undefined}
                >
                  {c.label}
                  {sorted === "asc" ? " ▲" : sorted === "desc" ? " ▼" : ""}
                  <div
                    className={clsx(
                      "absolute top-0 right-0 h-full w-1.25 cursor-col-resize bg-transparent select-none hover:bg-brass",
                      resizingId === c.id && "bg-brass",
                    )}
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
                className="p-15 text-center font-display text-[1.4rem] text-ink-dim italic"
              >
                the logbook is empty.
              </td>
            </tr>
          ) : (
            events.map((e) => (
              <tr
                key={e.id}
                className={clsx(
                  "cursor-pointer transition-colors duration-140 hover:bg-bg-hover",
                  selectedId === e.id &&
                    "bg-brass/6 shadow-[inset_2px_0_0_var(--color-brass)]",
                  freshIds.has(e.id) && "animate-row-fresh",
                )}
                onClick={() => onRowClick(e)}
              >
                {visibleColumns.map((c) => (
                  <td
                    key={c.id}
                    style={{ width: colWidth(c) }}
                    className={tdCls}
                  >
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
