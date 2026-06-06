import type { ReactNode } from "react";
import type { Event } from "../../types";
import { actionBadge } from "../../policyBadges";
import { formatAbsolute, formatRelative } from "../../utils/relativeTime";
import { shortJson } from "../../utils/eventsExport";

export type ColumnSizing = Record<string, number>;
export type ColumnVisibility = Record<string, boolean>;

export interface ColumnCtx {
  nowTick: number;
  onFilterBinary: (b: string) => void;
  onFilterWorkdir: (w: string) => void;
}

export interface ColumnSpec {
  id: keyof Event;
  label: string;
  defaultSize: number;
  sortable: boolean;
  render: (e: Event, ctx: ColumnCtx) => ReactNode;
}

export const MIN_COL_WIDTH = 60;

const cellLinkCls =
  "cursor-pointer border-b border-dashed border-transparent text-left font-mono text-body hover:border-brass-dim hover:text-brass";

const dash = <span className="text-ink-mute italic">—</span>;

export const EVENT_COLUMNS: ColumnSpec[] = [
  {
    id: "timestamp",
    label: "Time",
    defaultSize: 150,
    sortable: true,
    render: (e, ctx) => (
      <span className="font-mono text-body" title={formatAbsolute(e.timestamp)}>
        {formatRelative(e.timestamp, ctx.nowTick)}
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
    render: (e, ctx) =>
      e.binary ? (
        <button
          className={cellLinkCls}
          onClick={(ev) => {
            ev.stopPropagation();
            ctx.onFilterBinary(e.binary);
          }}
        >
          {e.binary}
        </button>
      ) : (
        dash
      ),
  },
  {
    id: "file",
    label: "File",
    defaultSize: 240,
    sortable: true,
    render: (e) =>
      e.file ? <span className="font-mono text-body">{e.file}</span> : dash,
  },
  {
    id: "action",
    label: "Action",
    defaultSize: 100,
    sortable: true,
    render: (e) => actionBadge(e.action),
  },
  {
    id: "would_action",
    label: "Would",
    defaultSize: 100,
    sortable: true,
    render: (e) => (e.would_action ? actionBadge(e.would_action) : dash),
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
    render: (e, ctx) =>
      e.workdir ? (
        <button
          className={cellLinkCls}
          onClick={(ev) => {
            ev.stopPropagation();
            ctx.onFilterWorkdir(e.workdir);
          }}
        >
          {e.workdir}
        </button>
      ) : (
        dash
      ),
  },
  {
    id: "tool_input",
    label: "Input",
    defaultSize: 280,
    sortable: false,
    render: (e) => (
      <span className="font-mono text-body text-ink-mute italic">
        {shortJson(e.tool_input)}
      </span>
    ),
  },
  {
    id: "raw_name",
    label: "Raw",
    defaultSize: 110,
    sortable: true,
    render: (e) => e.raw_name || dash,
  },
  {
    id: "session",
    label: "Session",
    defaultSize: 100,
    sortable: false,
    render: (e) => (
      <span className="font-mono text-body">{e.session.slice(0, 8)}</span>
    ),
  },
];
