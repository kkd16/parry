import { useMemo, useState } from "react";
import clsx from "clsx";
import PageHeader from "./components/PageHeader";
import DevDocsDrawer from "./components/DevDocsDrawer";
import {
  DOC_EDGES,
  DOC_NODES,
  layoutDocs,
  nodeById,
  type DocEdge,
  type PlacedNode,
} from "./devdocs";

const TOP_Y = 16;
const CORNER = 18;
const FORK_X = 6;

const ACCENT_CLS: Record<string, string> = {
  brass: "stroke-brass-dim",
  confirm: "stroke-confirm/55",
  block: "stroke-block/55",
  allow: "stroke-allow/55",
};

const LEGEND: [string, string][] = [
  ["w-5.5 border-t-2 border-brass-dim", "main flow"],
  ["w-5.5 border-t-2 border-dashed border-rule", "side tap"],
  ["h-2.5 w-3.5 rounded-sm border border-rule bg-bg", "shipped"],
  [
    "h-2.5 w-3.5 rounded-sm border border-dashed border-brass-dim bg-bg opacity-60",
    "planned",
  ],
];

interface EdgeLabel {
  x: number;
  y: number;
  text: string;
}

interface EdgeGeometry {
  d: string;
  label?: EdgeLabel;
}

function edgeGeometry(e: DocEdge, f: PlacedNode, t: PlacedNode): EdgeGeometry {
  if (t.lane < f.lane) {
    const d = [
      `M ${f.cx} ${f.y}`,
      `L ${f.cx} ${TOP_Y + CORNER}`,
      `Q ${f.cx} ${TOP_Y} ${f.cx - CORNER} ${TOP_Y}`,
      `L ${t.cx + CORNER} ${TOP_Y}`,
      `Q ${t.cx} ${TOP_Y} ${t.cx} ${TOP_Y + CORNER}`,
      `L ${t.cx} ${t.y}`,
    ].join(" ");
    const label = e.label
      ? { x: f.cx - 54, y: TOP_Y + 14, text: e.label }
      : undefined;
    return { d, label };
  }
  if (f.lane === t.lane) {
    const d = `M ${f.cx} ${f.y + f.h} L ${f.cx} ${t.y}`;
    const label = e.label
      ? { x: f.cx + 10, y: (f.y + f.h + t.y) / 2 + 3, text: e.label }
      : undefined;
    return { d, label };
  }
  if (t.order > f.order) {
    const x1 = f.x + f.w - FORK_X;
    const y1 = f.y + f.h;
    const x2 = t.x;
    const y2 = t.cy;
    const d = `M ${x1} ${y1} C ${x1} ${y2}, ${x2 - 20} ${y2}, ${x2} ${y2}`;
    const label = e.label
      ? { x: x1 + 18, y: (y1 + y2) / 2 + 3, text: e.label }
      : undefined;
    return { d, label };
  }
  const x1 = f.x + f.w;
  const x2 = t.x;
  const dx = Math.max(24, (x2 - x1) * 0.5);
  const d = `M ${x1} ${f.cy} C ${x1 + dx} ${f.cy}, ${x2 - dx} ${t.cy}, ${x2} ${t.cy}`;
  const label = e.label
    ? { x: (x1 + x2) / 2, y: f.cy - 9, text: e.label }
    : undefined;
  return { d, label };
}

export default function DevDocsPage() {
  const [openId, setOpenId] = useState<string | null>(null);
  const { placed, width, height } = useMemo(() => layoutDocs(DOC_NODES), []);
  const byId = useMemo(() => new Map(placed.map((n) => [n.id, n])), [placed]);

  const edges = useMemo(
    () =>
      DOC_EDGES.flatMap((e) => {
        const f = byId.get(e.from);
        const t = byId.get(e.to);
        if (!f || !t) return [];
        const planned = f.status === "planned" || t.status === "planned";
        return [{ edge: e, geo: edgeGeometry(e, f, t), planned }];
      }),
    [byId],
  );

  const openNode = openId ? (nodeById(openId) ?? null) : null;

  return (
    <>
      <PageHeader
        eyebrow="developer reference"
        title="Dev Docs"
        sub="how a tool call moves through Parry — click any component to drill in"
      />

      <div className="rounded-md border border-rule bg-bg-raised px-3 pt-4 pb-3.5">
        <svg
          className="block h-auto w-full"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label="Parry architecture flow diagram"
        >
          <defs>
            <marker
              id="docs-arrow"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto"
            >
              <path
                d="M 1 1.5 L 8 5 L 1 8.5"
                fill="none"
                stroke="var(--color-brass-dim)"
                strokeWidth="1.6"
              />
            </marker>
            <marker
              id="docs-arrow-planned"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto"
            >
              <path
                d="M 1 1.5 L 8 5 L 1 8.5"
                fill="none"
                stroke="var(--color-ink-mute)"
                strokeWidth="1.6"
              />
            </marker>
          </defs>

          {edges.map(({ edge, geo, planned }) => (
            <g key={`${edge.from}-${edge.to}`}>
              <path
                className={clsx(
                  "fill-none [stroke-width:1.4]",
                  edge.kind === "main" ? "stroke-brass-dim" : "stroke-rule",
                  edge.kind === "tap" && "[stroke-dasharray:4_4]",
                  planned ? "opacity-35" : edge.kind === "main" && "opacity-60",
                )}
                d={geo.d}
                markerEnd={
                  planned ? "url(#docs-arrow-planned)" : "url(#docs-arrow)"
                }
              />
              {geo.label && (
                <text
                  className="fill-ink-mute font-mono text-[9px] tracking-[0.06em] uppercase"
                  x={geo.label.x}
                  y={geo.label.y}
                  textAnchor="middle"
                >
                  {geo.label.text}
                </text>
              )}
            </g>
          ))}

          {edges
            .filter(({ edge, planned }) => edge.kind === "main" && !planned)
            .map(({ edge, geo }, i) => (
              <path
                key={`pulse-${edge.from}-${edge.to}`}
                className="pointer-events-none animate-docs-pulse fill-none stroke-brass-bright stroke-2 opacity-85 [stroke-dasharray:7_93] [stroke-linecap:round] motion-reduce:animate-none motion-reduce:opacity-0"
                d={geo.d}
                pathLength={100}
                style={{ animationDelay: `${i * 0.34}s` }}
              />
            ))}

          {placed.map((n) => (
            <g
              key={n.id}
              className={clsx(
                "group cursor-pointer outline-none",
                n.status === "planned" && "opacity-50 hover:opacity-85",
              )}
              role="button"
              tabIndex={0}
              aria-label={`${n.title} — ${n.oneliner}`}
              onClick={() => setOpenId(n.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setOpenId(n.id);
                }
              }}
            >
              <rect
                className={clsx(
                  "fill-bg [stroke-width:1.2] transition-[stroke,fill] duration-150 group-hover:fill-bg-hover group-hover:stroke-brass group-focus-visible:fill-bg-hover group-focus-visible:stroke-brass",
                  (n.accent &&
                    n.accent !== "neutral" &&
                    ACCENT_CLS[n.accent]) ||
                    "stroke-rule",
                  n.status === "planned" && "[stroke-dasharray:4_3]",
                )}
                x={n.x}
                y={n.y}
                width={n.w}
                height={n.h}
                rx={5}
              />
              <text
                className="fill-ink font-sans text-[13px] font-[550]"
                x={n.cx}
                y={n.y + 27}
                textAnchor="middle"
              >
                {n.title}
              </text>
              <text
                className="fill-ink-mute font-mono text-[9.5px] tracking-[0.04em]"
                x={n.cx}
                y={n.y + 45}
                textAnchor="middle"
              >
                {n.pkgHint}
              </text>
              {n.status === "planned" && (
                <g>
                  <rect
                    className="fill-bg-raised stroke-brass-dim [stroke-dasharray:3_2]"
                    x={n.x + n.w - 56}
                    y={n.y - 8}
                    width={52}
                    height={15}
                    rx={3}
                  />
                  <text
                    className="fill-brass font-mono text-[8px] tracking-[0.08em] uppercase"
                    x={n.x + n.w - 30}
                    y={n.y + 3}
                    textAnchor="middle"
                  >
                    planned
                  </text>
                </g>
              )}
            </g>
          ))}
        </svg>

        <div className="mt-2.5 flex flex-wrap gap-4.5 border-t border-dashed border-rule-soft px-2.5 pt-2 font-mono text-micro tracking-[0.08em] text-ink-dim uppercase">
          {LEGEND.map(([swatch, label]) => (
            <span key={label} className="inline-flex items-center gap-[7px]">
              <span className={swatch} />
              {label}
            </span>
          ))}
        </div>
      </div>

      <DevDocsDrawer
        node={openNode}
        onClose={() => setOpenId(null)}
        onNavigate={setOpenId}
      />
    </>
  );
}
