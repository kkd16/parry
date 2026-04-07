import { useEffect, useMemo, useRef, useState, useCallback } from "react";

interface HeatmapFile {
  path: string;
  count: number;
}

interface HeatmapProject {
  workdir: string;
  files: HeatmapFile[];
  total: number;
}

interface HeatmapResponse {
  projects: HeatmapProject[];
}

interface Body {
  x: number;
  y: number;
  r: number;
  path: string;
  name: string;
  count: number;
}

const BODY_FILL = "#e8f1ff";
const BODY_STROKE = "#4ea1ff";

interface System {
  cx: number;
  cy: number;
  label: string;
  workdir: string;
  bodies: Body[];
  orbitRadii: number[];
}

const COLS = 2;
const SYSTEM_W = 900;
const SYSTEM_H = 780;
const INNER_ORBIT = 90;
const ORBIT_SPAN = 220;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

function basename(p: string): string {
  const idx = p.lastIndexOf("/");
  return idx >= 0 ? p.slice(idx + 1) : p;
}

function buildSystems(projects: HeatmapProject[]): System[] {
  return projects.map((p, idx) => {
    const col = idx % COLS;
    const row = Math.floor(idx / COLS);
    const cx = col * SYSTEM_W + SYSTEM_W / 2;
    const cy = row * SYSTEM_H + SYSTEM_H / 2;
    const maxCount = p.files.reduce((m, f) => Math.max(m, f.count), 1);

    const sorted = [...p.files].sort((a, b) => b.count - a.count);
    const bodies: Body[] = sorted.map((f, i) => {
      const orbit = INNER_ORBIT + (1 - f.count / maxCount) * ORBIT_SPAN;
      const angle = GOLDEN_ANGLE * i;
      return {
        x: cx + orbit * Math.cos(angle),
        y: cy + orbit * Math.sin(angle),
        r: 5 + Math.sqrt(f.count) * 4,
        path: f.path,
        name: basename(f.path),
        count: f.count,
      };
    });

    const orbitRadii: number[] = [];
    for (let k = 0; k <= 4; k++) {
      orbitRadii.push(INNER_ORBIT + (k / 4) * ORBIT_SPAN);
    }

    return {
      cx,
      cy,
      label: basename(p.workdir) || p.workdir,
      workdir: p.workdir,
      bodies,
      orbitRadii,
    };
  });
}

function seededStars(count: number, w: number, h: number): { x: number; y: number; r: number }[] {
  const stars: { x: number; y: number; r: number }[] = [];
  let seed = 1337;
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  for (let i = 0; i < count; i++) {
    stars.push({
      x: rand() * w,
      y: rand() * h,
      r: rand() < 0.9 ? 0.6 : 1.4,
    });
  }
  return stars;
}

interface Hover {
  x: number;
  y: number;
  body: Body;
}

export default function HeatmapPage() {
  const [data, setData] = useState<HeatmapResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState({ tx: 0, ty: 0, scale: 1 });
  const [hover, setHover] = useState<Hover | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);

  useEffect(() => {
    fetch("/api/heatmap")
      .then((r) => r.json())
      .then((json: HeatmapResponse | { error: string }) => {
        if ("error" in json) {
          setError(json.error);
          return;
        }
        setData(json);
      })
      .catch((e: unknown) => setError(String(e)));
  }, []);

  const systems = useMemo(() => (data ? buildSystems(data.projects) : []), [data]);

  const worldBounds = useMemo(() => {
    if (systems.length === 0) return { w: SYSTEM_W, h: SYSTEM_H };
    const rows = Math.ceil(systems.length / COLS);
    const cols = Math.min(COLS, systems.length);
    return { w: cols * SYSTEM_W, h: rows * SYSTEM_H };
  }, [systems]);

  const stars = useMemo(
    () => seededStars(260, worldBounds.w, worldBounds.h),
    [worldBounds.w, worldBounds.h],
  );

  const resetView = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    const scale = Math.min(vw / worldBounds.w, vh / worldBounds.h) * 0.9;
    const tx = (vw - worldBounds.w * scale) / 2;
    const ty = (vh - worldBounds.h * scale) / 2;
    setView({ tx, ty, scale });
  }, [worldBounds.w, worldBounds.h]);

  useEffect(() => {
    if (systems.length === 0) return;
    const el = containerRef.current;
    if (!el) return;
    const vw = el.clientWidth;
    const vh = el.clientHeight;

    const first = systems[0];
    const startScale = Math.min(vw / 500, vh / 500);
    const startTx = vw / 2 - first.cx * startScale;
    const startTy = vh / 2 - first.cy * startScale;

    const endScale = Math.min(vw / worldBounds.w, vh / worldBounds.h) * 0.9;
    const endTx = (vw - worldBounds.w * endScale) / 2;
    const endTy = (vh - worldBounds.h * endScale) / 2;

    let raf = 0;
    const duration = 1100;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      setView({
        tx: startTx + (endTx - startTx) * ease,
        ty: startTy + (endTy - startTy) * ease,
        scale: startScale + (endScale - startScale) * ease,
      });
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [systems, worldBounds.w, worldBounds.h]);

  const onMouseDown = (e: React.MouseEvent) => {
    dragState.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    const d = dragState.current;
    if (!d) return;
    setView((v) => ({ ...v, tx: d.tx + (e.clientX - d.x), ty: d.ty + (e.clientY - d.y) }));
  };
  const onMouseUp = () => {
    dragState.current = null;
  };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const factor = Math.exp(-e.deltaY * 0.0015);
    setView((v) => {
      const next = Math.min(6, Math.max(0.15, v.scale * factor));
      const ratio = next / v.scale;
      return {
        scale: next,
        tx: mx - (mx - v.tx) * ratio,
        ty: my - (my - v.ty) * ratio,
      };
    });
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => e.preventDefault();
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, []);

  if (error) return <div className="heatmap-empty">Error: {error}</div>;
  if (!data) return <div className="heatmap-empty">Loading...</div>;
  if (systems.length === 0) {
    return (
      <div className="heatmap-empty">
        No file events recorded yet. Run some tool calls with <code>parry check</code> first.
      </div>
    );
  }

  const showLabels = view.scale > 0.7;

  return (
    <div
      className="heatmap-canvas"
      ref={containerRef}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onWheel={onWheel}
    >
      <svg width="100%" height="100%">
        <defs>
          <filter id="bodyGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`}>
          {stars.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#2a3444" />
          ))}

          {systems.map((sys) => (
            <g key={sys.workdir}>
              {sys.orbitRadii.map((r, i) => (
                <circle
                  key={i}
                  cx={sys.cx}
                  cy={sys.cy}
                  r={r}
                  fill="none"
                  stroke="#1d2733"
                  strokeWidth={1}
                  strokeDasharray="3 6"
                />
              ))}

              <circle cx={sys.cx} cy={sys.cy} r={18} fill="#f5d76e" opacity={0.92} />
              <circle cx={sys.cx} cy={sys.cy} r={32} fill="#f5d76e" opacity={0.12} />
              <text
                x={sys.cx}
                y={sys.cy + 52}
                textAnchor="middle"
                fill="#c9d1d9"
                fontSize={16}
                fontFamily="monospace"
                style={{ pointerEvents: "none" }}
              >
                {sys.label}
              </text>

              {sys.bodies.map((b, i) => (
                <g
                  key={i}
                  onMouseEnter={(e) => {
                    const rect = containerRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    setHover({ x: e.clientX - rect.left, y: e.clientY - rect.top, body: b });
                  }}
                  onMouseMove={(e) => {
                    const rect = containerRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    setHover({ x: e.clientX - rect.left, y: e.clientY - rect.top, body: b });
                  }}
                  onMouseLeave={() => setHover(null)}
                >
                  <circle
                    cx={b.x}
                    cy={b.y}
                    r={b.r}
                    fill={BODY_FILL}
                    stroke={BODY_STROKE}
                    strokeWidth={1.5}
                    filter="url(#bodyGlow)"
                  />
                  {showLabels && (
                    <text
                      x={b.x + b.r + 4}
                      y={b.y + 3}
                      fill="#8b949e"
                      fontSize={9}
                      fontFamily="monospace"
                      style={{ pointerEvents: "none" }}
                    >
                      {b.name}
                    </text>
                  )}
                </g>
              ))}
            </g>
          ))}
        </g>
      </svg>

      <div className="heatmap-controls">
        <button className="heatmap-reset" onClick={resetView}>
          reset view
        </button>
        <div className="heatmap-hint">drag to pan · scroll to zoom</div>
      </div>

      {hover && (
        <div
          className="heatmap-tooltip"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          <div className="heatmap-tooltip-path">{hover.body.path}</div>
          <div className="heatmap-tooltip-count">{hover.body.count} events</div>
        </div>
      )}
    </div>
  );
}
