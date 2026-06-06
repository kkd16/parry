import { useMemo, useState } from "react";
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
    const label = e.label ? { x: f.cx - 54, y: TOP_Y + 14, text: e.label } : undefined;
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
    const label = e.label ? { x: x1 + 18, y: (y1 + y2) / 2 + 3, text: e.label } : undefined;
    return { d, label };
  }
  const x1 = f.x + f.w;
  const x2 = t.x;
  const dx = Math.max(24, (x2 - x1) * 0.5);
  const d = `M ${x1} ${f.cy} C ${x1 + dx} ${f.cy}, ${x2 - dx} ${t.cy}, ${x2} ${t.cy}`;
  const label = e.label ? { x: (x1 + x2) / 2, y: f.cy - 9, text: e.label } : undefined;
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

      <div className="devdocs-canvas">
        <svg
          className="devdocs-svg"
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
              <path d="M 1 1.5 L 8 5 L 1 8.5" fill="none" stroke="var(--brass-dim)" strokeWidth="1.6" />
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
              <path d="M 1 1.5 L 8 5 L 1 8.5" fill="none" stroke="var(--ink-mute)" strokeWidth="1.6" />
            </marker>
          </defs>

          {edges.map(({ edge, geo, planned }) => (
            <g key={`${edge.from}-${edge.to}`}>
              <path
                className={`devdocs-edge ${edge.kind}${planned ? " to-planned" : ""}`}
                d={geo.d}
                markerEnd={planned ? "url(#docs-arrow-planned)" : "url(#docs-arrow)"}
              />
              {geo.label && (
                <text
                  className="devdocs-edge-label"
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
                className="devdocs-pulse"
                d={geo.d}
                pathLength={100}
                style={{ animationDelay: `${i * 0.34}s` }}
              />
            ))}

          {placed.map((n) => (
            <g
              key={n.id}
              className={`devdocs-node${n.status === "planned" ? " planned" : ""}`}
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
                className={`devdocs-node-rect${
                  n.accent && n.accent !== "neutral" ? ` accent-${n.accent}` : ""
                }`}
                x={n.x}
                y={n.y}
                width={n.w}
                height={n.h}
                rx={5}
              />
              <text className="devdocs-node-title" x={n.cx} y={n.y + 27} textAnchor="middle">
                {n.title}
              </text>
              <text className="devdocs-node-pkg" x={n.cx} y={n.y + 45} textAnchor="middle">
                {n.pkgHint}
              </text>
              {n.status === "planned" && (
                <g className="devdocs-node-flag">
                  <rect x={n.x + n.w - 56} y={n.y - 8} width={52} height={15} rx={3} />
                  <text x={n.x + n.w - 30} y={n.y + 3} textAnchor="middle">
                    planned
                  </text>
                </g>
              )}
            </g>
          ))}
        </svg>

        <div className="devdocs-legend">
          <span className="devdocs-legend-item">
            <span className="devdocs-legend-swatch" />
            main flow
          </span>
          <span className="devdocs-legend-item">
            <span className="devdocs-legend-swatch tap" />
            side tap
          </span>
          <span className="devdocs-legend-item">
            <span className="devdocs-legend-chip" />
            shipped
          </span>
          <span className="devdocs-legend-item">
            <span className="devdocs-legend-chip planned" />
            planned
          </span>
        </div>
      </div>

      <DevDocsDrawer node={openNode} onClose={() => setOpenId(null)} onNavigate={setOpenId} />
    </>
  );
}
