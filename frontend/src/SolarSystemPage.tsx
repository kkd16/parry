import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Maximize2, Minus, Orbit, Plus, RotateCcw } from "lucide-react";
import PageHeader from "./components/PageHeader";
import { useUrlParam } from "./hooks/useUrlState";
import { useRegisterCommands, type Command } from "./commands";

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

const BODY_FILL = "#f5e9d2";
const BODY_STROKE = "#d4a14a";
const SUN_FILL = "#f5c97a";

interface System {
  cx: number;
  cy: number;
  label: string;
  workdir: string;
  bodies: Body[];
  orbitRadii: number[];
  total: number;
  topFile: string;
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
      total: p.total,
      topFile: sorted[0]?.path ?? "",
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

export default function SolarSystemPage() {
  const [data, setData] = useState<HeatmapResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState({ tx: 0, ty: 0, scale: 1 });
  const [hover, setHover] = useState<Hover | null>(null);
  const [filterProject, setFilterProject] = useUrlParam("project", "");
  const containerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const flyRaf = useRef<number | null>(null);

  useEffect(() => {
    const main = document.querySelector(".shell-main") as HTMLElement | null;
    const prev = main?.style.overflow ?? "";
    if (main) main.style.overflow = "hidden";
    document.body.classList.add("solar-mode");
    return () => {
      if (main) main.style.overflow = prev;
      document.body.classList.remove("solar-mode");
    };
  }, []);

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

  const allSystems = useMemo(() => (data ? buildSystems(data.projects) : []), [data]);
  const systems = useMemo(
    () => (filterProject ? allSystems.filter((s) => s.workdir === filterProject) : allSystems),
    [allSystems, filterProject],
  );

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

  const flyTo = useCallback((targetTx: number, targetTy: number, targetScale: number) => {
    if (flyRaf.current != null) cancelAnimationFrame(flyRaf.current);
    const startView = { ...view };
    const start = performance.now();
    const duration = 700;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      setView({
        tx: startView.tx + (targetTx - startView.tx) * ease,
        ty: startView.ty + (targetTy - startView.ty) * ease,
        scale: startView.scale + (targetScale - startView.scale) * ease,
      });
      if (t < 1) flyRaf.current = requestAnimationFrame(tick);
    };
    flyRaf.current = requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetView = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    const scale = Math.min(vw / worldBounds.w, vh / worldBounds.h) * 0.9;
    const tx = (vw - worldBounds.w * scale) / 2;
    const ty = (vh - worldBounds.h * scale) / 2;
    flyTo(tx, ty, scale);
  }, [worldBounds.w, worldBounds.h, flyTo]);

  const flyToSystem = useCallback(
    (sys: System) => {
      const el = containerRef.current;
      if (!el) return;
      const vw = el.clientWidth;
      const vh = el.clientHeight;
      const scale = 1.4;
      flyTo(vw / 2 - sys.cx * scale, vh / 2 - sys.cy * scale, scale);
    },
    [flyTo],
  );

  const orreryCommands = useMemo<Command[]>(() => {
    const base: Command[] = [
      {
        id: "orrery.zoom-in",
        group: "Orrery",
        label: "Zoom in",
        icon: <Plus />,
        perform: () => {
          const el = containerRef.current;
          if (el) {
            setView((v) => {
              const next = Math.min(8, v.scale * 1.4);
              const ratio = next / v.scale;
              const cx = el.clientWidth / 2;
              const cy = el.clientHeight / 2;
              return { scale: next, tx: cx - (cx - v.tx) * ratio, ty: cy - (cy - v.ty) * ratio };
            });
          }
        },
      },
      {
        id: "orrery.zoom-out",
        group: "Orrery",
        label: "Zoom out",
        icon: <Minus />,
        perform: () => {
          const el = containerRef.current;
          if (el) {
            setView((v) => {
              const next = Math.max(0.1, v.scale / 1.4);
              const ratio = next / v.scale;
              const cx = el.clientWidth / 2;
              const cy = el.clientHeight / 2;
              return { scale: next, tx: cx - (cx - v.tx) * ratio, ty: cy - (cy - v.ty) * ratio };
            });
          }
        },
      },
      {
        id: "orrery.reset",
        group: "Orrery",
        label: "Reset view",
        icon: <RotateCcw />,
        perform: resetView,
      },
      {
        id: "orrery.show-all",
        group: "Orrery",
        label: "Show all systems",
        icon: <Maximize2 />,
        perform: () => setFilterProject(""),
      },
    ];
    for (const sys of allSystems) {
      base.push({
        id: `orrery.fly.${sys.workdir}`,
        group: "Fly to system",
        label: sys.label,
        icon: <Orbit />,
        keywords: [sys.workdir, "fly", "go"],
        perform: () => {
          setFilterProject("");
          flyToSystem(sys);
        },
      });
    }
    return base;
  }, [allSystems, flyToSystem, resetView, setFilterProject]);
  useRegisterCommands(orreryCommands, [orreryCommands]);

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
    setView({ tx: startTx, ty: startTy, scale: startScale });
    const endScale = Math.min(vw / worldBounds.w, vh / worldBounds.h) * 0.9;
    const endTx = (vw - worldBounds.w * endScale) / 2;
    const endTy = (vh - worldBounds.h * endScale) / 2;
    const start = performance.now();
    const duration = 1100;
    let raf = 0;
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

  const onDoubleClick = (e: React.MouseEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.shiftKey ? 1 / 1.8 : 1.8);
  };

  const zoomAt = useCallback((mx: number, my: number, factor: number) => {
    setView((v) => {
      const next = Math.min(8, Math.max(0.1, v.scale * factor));
      const ratio = next / v.scale;
      return {
        scale: next,
        tx: mx - (mx - v.tx) * ratio,
        ty: my - (my - v.ty) * ratio,
      };
    });
  }, []);

  const zoomCentered = useCallback(
    (factor: number) => {
      const el = containerRef.current;
      if (!el) return;
      zoomAt(el.clientWidth / 2, el.clientHeight / 2, factor);
    },
    [zoomAt],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      // normalize deltaY across deltaMode: 0=pixel, 1=line, 2=page
      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 16;
      else if (e.deltaMode === 2) delta *= 100;
      // device detection:
      //  - pinch zoom: ctrlKey true (browsers synthesize this for two-finger pinch)
      //  - trackpad scroll: small fractional deltas, no ctrlKey
      //  - mouse wheel: large integer deltas (often multiples of 100)
      const isPinch = e.ctrlKey;
      // trackpad two-finger scroll: small deltas (<50). mouse wheel: ~100+ per click.
      const isTrackpadScroll = !isPinch && Math.abs(delta) < 50;
      let intensity: number;
      if (isPinch) intensity = 0.012;
      else if (isTrackpadScroll) intensity = 0.015;
      else intensity = 0.0025;
      const factor = Math.exp(-delta * intensity);
      zoomAt(mx, my, factor);
    };
    el.addEventListener("wheel", handler, { passive: false });
    return () => el.removeEventListener("wheel", handler);
  }, [zoomAt, data]);

  const stats = useMemo(() => {
    if (!data) return null;
    let totalEvents = 0;
    let totalFiles = 0;
    let topFile = { path: "", count: 0 };
    let topProject = { workdir: "", count: 0 };
    for (const p of data.projects) {
      totalEvents += p.total;
      totalFiles += p.files.length;
      if (p.total > topProject.count) topProject = { workdir: p.workdir, count: p.total };
      for (const f of p.files) {
        if (f.count > topFile.count) topFile = { path: f.path, count: f.count };
      }
    }
    return {
      projects: data.projects.length,
      totalFiles,
      totalEvents,
      topFile,
      topProject,
    };
  }, [data]);

  if (error)
    return (
      <>
        <PageHeader eyebrow="instrument · 02" title="Orrery" />
        <div className="error">{error}</div>
      </>
    );
  if (!data)
    return (
      <>
        <PageHeader eyebrow="instrument · 02" title="Orrery" />
        <div className="heatmap-empty">charting the heavens…</div>
      </>
    );
  if (allSystems.length === 0) {
    return (
      <>
        <PageHeader eyebrow="instrument · 02" title="Orrery" />
        <div className="heatmap-empty">
          the sky is empty.
          <div style={{ fontSize: "0.8rem", marginTop: 12, fontStyle: "normal" }}>
            run some tool calls with <code>parry check</code> first.
          </div>
        </div>
      </>
    );
  }

  const showLabels = view.scale > 0.7;

  return (
    <div
      className="heatmap-canvas orrery-fullscreen"
      ref={containerRef}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onDoubleClick={onDoubleClick}
    >
      <div className="orrery-header-overlay">
        <PageHeader
          eyebrow="instrument · 02"
          title="Orrery"
          sub="files orbit their projects · drag to pan · scroll to zoom"
        />
        {stats && (
          <div className="orrery-tally">
            <div className="orrery-tally-title">tally</div>
            <div className="orrery-tally-stat">
              <span className="orrery-tally-label">projects</span>
              <span className="orrery-tally-value">{stats.projects}</span>
            </div>
            <div className="orrery-tally-stat">
              <span className="orrery-tally-label">files</span>
              <span className="orrery-tally-value">{stats.totalFiles}</span>
            </div>
            <div className="orrery-tally-stat">
              <span className="orrery-tally-label">events</span>
              <span className="orrery-tally-value">
                {stats.totalEvents.toLocaleString()}
              </span>
            </div>
            <div className="orrery-tally-stat orrery-tally-stat-wide">
              <span className="orrery-tally-label">hottest</span>
              <span className="orrery-tally-value">
                {basename(stats.topFile.path)}{" "}
                <span className="orrery-tally-mute">×{stats.topFile.count}</span>
              </span>
            </div>
          </div>
        )}
      </div>

      <svg width="100%" height="100%">
          <defs>
            <filter id="bodyGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="sunGlow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="6" />
            </filter>
          </defs>
          <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`}>
            {stars.map((s, i) => (
              <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#2a3040" />
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
                    stroke="#1d2030"
                    strokeWidth={1}
                    strokeDasharray="2 7"
                  />
                ))}
                <circle
                  cx={sys.cx}
                  cy={sys.cy}
                  r={42}
                  fill={SUN_FILL}
                  opacity={0.18}
                  filter="url(#sunGlow)"
                />
                <circle cx={sys.cx} cy={sys.cy} r={20} fill={SUN_FILL} />
                <text
                  x={sys.cx}
                  y={sys.cy + 56}
                  textAnchor="middle"
                  fill="#eae3d2"
                  fontSize={18}
                  fontFamily="Instrument Serif, serif"
                  fontStyle="italic"
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
                        fill="#8a8478"
                        fontSize={9}
                        fontFamily="JetBrains Mono, monospace"
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

        <div className="heatmap-overlay legend">
          <div className="heatmap-overlay-title">legend</div>
          <div style={{ marginBottom: 8, lineHeight: 1.6 }}>
            inner orbit · hottest
            <br />
            larger body · more accesses
          </div>
          <div style={{ borderTop: "1px solid var(--rule)", paddingTop: 8, marginTop: 4 }}>
            <div style={{ color: "var(--ink-mute)", marginBottom: 4 }}>systems</div>
            {allSystems.map((s) => (
              <button
                key={s.workdir}
                className={`legend-map-entry${filterProject === s.workdir ? " active" : ""}`}
                onClick={() => flyToSystem(s)}
                onDoubleClick={() =>
                  setFilterProject(filterProject === s.workdir ? "" : s.workdir)
                }
                title="click: fly to · double-click: isolate"
              >
                · {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="heatmap-overlay controls">
          <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
            <button
              className="btn"
              style={{ flex: 1 }}
              onClick={() => zoomCentered(1.4)}
              title="zoom in"
            >
              +
            </button>
            <button
              className="btn"
              style={{ flex: 1 }}
              onClick={() => zoomCentered(1 / 1.4)}
              title="zoom out"
            >
              −
            </button>
          </div>
          {filterProject && (
            <button
              className="btn"
              style={{ marginBottom: 6, width: "100%" }}
              onClick={() => setFilterProject("")}
            >
              show all
            </button>
          )}
          <button className="btn" style={{ width: "100%" }} onClick={resetView}>
            reset view
          </button>
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
