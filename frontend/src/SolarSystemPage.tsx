import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import clsx from "clsx";
import { Maximize2, Minus, Orbit, Plus, RotateCcw } from "lucide-react";
import PageHeader from "./components/PageHeader";
import { Btn, ErrorBox } from "./components/ui";
import { useUrlParam } from "./hooks/useUrlState";
import { useRegisterCommands, type Command } from "./commands";
import { basename } from "./utils/format";
import type { HeatmapProject, HeatmapResponse } from "./types";

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

interface View {
  tx: number;
  ty: number;
  scale: number;
}

const COLS = 2;
const SYSTEM_W = 900;
const SYSTEM_H = 780;
const INNER_ORBIT = 90;
const ORBIT_SPAN = 220;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const emptyCls =
  "p-15 text-center font-display text-[1.6rem] text-ink-dim italic [&_code]:font-mono [&_code]:text-[0.9rem] [&_code]:text-brass [&_code]:not-italic";

const overlayCls =
  "absolute z-5 rounded border border-rule bg-[rgba(17,19,28,0.92)] px-4 py-3.5 font-mono text-meta text-ink-dim backdrop-blur-[6px]";

const tallyLabelCls = "text-eyebrow tracking-[0.18em] text-ink-mute uppercase";

const tallyValueCls = "truncate text-[0.92rem] text-ink";

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

function seededStars(
  count: number,
  w: number,
  h: number,
): { x: number; y: number; r: number }[] {
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

interface Props {
  heatmap: HeatmapResponse | null;
  error: string | null;
}

export default function SolarSystemPage({ heatmap, error }: Props) {
  const [view, setView] = useState<View>({ tx: 0, ty: 0, scale: 1 });
  const [hover, setHover] = useState<Hover | null>(null);
  const [filterProject, setFilterProject] = useUrlParam("project", "");
  const containerRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{
    x: number;
    y: number;
    tx: number;
    ty: number;
  } | null>(null);
  const viewRef = useRef(view);
  const animRaf = useRef<number | null>(null);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  useEffect(() => {
    const main = document.querySelector(".shell-main") as HTMLElement | null;
    const prev = main?.style.overflow ?? "";
    if (main) main.style.overflow = "hidden";
    return () => {
      if (main) main.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (animRaf.current != null) cancelAnimationFrame(animRaf.current);
    };
  }, []);

  const allSystems = useMemo(
    () => (heatmap ? buildSystems(heatmap.projects) : []),
    [heatmap],
  );
  const systems = useMemo(
    () =>
      filterProject
        ? allSystems.filter((s) => s.workdir === filterProject)
        : allSystems,
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

  const animateView = useCallback((from: View, to: View, duration: number) => {
    if (animRaf.current != null) cancelAnimationFrame(animRaf.current);
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      setView({
        tx: from.tx + (to.tx - from.tx) * ease,
        ty: from.ty + (to.ty - from.ty) * ease,
        scale: from.scale + (to.scale - from.scale) * ease,
      });
      if (t < 1) animRaf.current = requestAnimationFrame(tick);
    };
    animRaf.current = requestAnimationFrame(tick);
  }, []);

  const flyTo = useCallback(
    (to: View) => animateView(viewRef.current, to, 700),
    [animateView],
  );

  const resetView = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    const scale = Math.min(vw / worldBounds.w, vh / worldBounds.h) * 0.9;
    const tx = (vw - worldBounds.w * scale) / 2;
    const ty = (vh - worldBounds.h * scale) / 2;
    flyTo({ tx, ty, scale });
  }, [worldBounds.w, worldBounds.h, flyTo]);

  const flyToSystem = useCallback(
    (sys: System) => {
      const el = containerRef.current;
      if (!el) return;
      const scale = 1.4;
      flyTo({
        tx: el.clientWidth / 2 - sys.cx * scale,
        ty: el.clientHeight / 2 - sys.cy * scale,
        scale,
      });
    },
    [flyTo],
  );

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

  const orreryCommands = useMemo<Command[]>(
    () => [
      {
        id: "orrery.zoom-in",
        group: "Orrery",
        label: "Zoom in",
        icon: <Plus />,
        perform: () => zoomCentered(1.4),
      },
      {
        id: "orrery.zoom-out",
        group: "Orrery",
        label: "Zoom out",
        icon: <Minus />,
        perform: () => zoomCentered(1 / 1.4),
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
      ...allSystems.map((sys) => ({
        id: `orrery.fly.${sys.workdir}`,
        group: "Fly to system",
        label: sys.label,
        icon: <Orbit />,
        keywords: [sys.workdir, "fly", "go"],
        perform: () => {
          setFilterProject("");
          flyToSystem(sys);
        },
      })),
    ],
    [allSystems, flyToSystem, resetView, setFilterProject, zoomCentered],
  );
  useRegisterCommands(orreryCommands, [orreryCommands]);

  useEffect(() => {
    if (systems.length === 0) return;
    const el = containerRef.current;
    if (!el) return;
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    const first = systems[0];
    const startScale = Math.min(vw / 500, vh / 500);
    const start = {
      tx: vw / 2 - first.cx * startScale,
      ty: vh / 2 - first.cy * startScale,
      scale: startScale,
    };
    const endScale = Math.min(vw / worldBounds.w, vh / worldBounds.h) * 0.9;
    const end = {
      tx: (vw - worldBounds.w * endScale) / 2,
      ty: (vh - worldBounds.h * endScale) / 2,
      scale: endScale,
    };
    setView(start);
    animateView(start, end, 1100);
  }, [systems, worldBounds.w, worldBounds.h, animateView]);

  const onMouseDown = (e: React.MouseEvent) => {
    dragState.current = {
      x: e.clientX,
      y: e.clientY,
      tx: view.tx,
      ty: view.ty,
    };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    const d = dragState.current;
    if (!d) return;
    setView((v) => ({
      ...v,
      tx: d.tx + (e.clientX - d.x),
      ty: d.ty + (e.clientY - d.y),
    }));
  };
  const onMouseUp = () => {
    dragState.current = null;
  };

  const onDoubleClick = (e: React.MouseEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    zoomAt(
      e.clientX - rect.left,
      e.clientY - rect.top,
      e.shiftKey ? 1 / 1.8 : 1.8,
    );
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const handler = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      let delta = e.deltaY;
      if (e.deltaMode === 1) delta *= 16;
      else if (e.deltaMode === 2) delta *= 100;
      const isPinch = e.ctrlKey;
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
  }, [zoomAt, heatmap]);

  const stats = useMemo(() => {
    if (!heatmap) return null;
    let totalEvents = 0;
    let totalFiles = 0;
    let topFile = { path: "", count: 0 };
    let topProject = { workdir: "", count: 0 };
    for (const p of heatmap.projects) {
      totalEvents += p.total;
      totalFiles += p.fileCount;
      if (p.total > topProject.count)
        topProject = { workdir: p.workdir, count: p.total };
      for (const f of p.files) {
        if (f.count > topFile.count) topFile = { path: f.path, count: f.count };
      }
    }
    return {
      projects: heatmap.projects.length,
      totalFiles,
      totalEvents,
      topFile,
      topProject,
    };
  }, [heatmap]);

  if (error)
    return (
      <>
        <PageHeader eyebrow="instrument · 02" title="Orrery" />
        <ErrorBox>{error}</ErrorBox>
      </>
    );
  if (!heatmap)
    return (
      <>
        <PageHeader eyebrow="instrument · 02" title="Orrery" />
        <div className={emptyCls}>charting the heavens…</div>
      </>
    );
  if (allSystems.length === 0) {
    return (
      <>
        <PageHeader eyebrow="instrument · 02" title="Orrery" />
        <div className={emptyCls}>
          the sky is empty.
          <div className="mt-3 text-[0.8rem] not-italic">
            run some tool calls with <code>parry check</code> first.
          </div>
        </div>
      </>
    );
  }

  const showLabels = view.scale > 0.7;

  return (
    <div
      className="relative h-screen w-full cursor-grab [touch-action:none] overflow-hidden [overscroll-behavior:contain] bg-[radial-gradient(ellipse_at_center,#060912_0%,#000000_100%)] select-none active:cursor-grabbing [&_svg]:block"
      ref={containerRef}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
      onDoubleClick={onDoubleClick}
    >
      <div className="pointer-events-none absolute top-8 right-10 left-10 z-8 flex items-start justify-between gap-6 [&>*]:pointer-events-auto">
        <PageHeader
          eyebrow="instrument · 02"
          title="Orrery"
          sub="files orbit their projects · drag to pan · scroll to zoom"
          flush
          className="flex-1 bg-[linear-gradient(180deg,rgba(10,11,16,0.7)_0%,transparent_100%)] pt-1 pr-4 pb-4.5"
          titleClassName="[text-shadow:0_2px_24px_rgba(0,0,0,0.8)]"
        />
        {stats && (
          <div className="flex shrink-0 items-center gap-5.5 rounded-md border border-brass-dim bg-[rgba(17,19,28,0.82)] px-5.5 py-3.5 font-mono backdrop-blur-[8px]">
            <div className="border-r border-rule pr-5.5 font-display text-[1.4rem] text-brass italic">
              tally
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className={tallyLabelCls}>projects</span>
              <span className={tallyValueCls}>{stats.projects}</span>
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className={tallyLabelCls}>files</span>
              <span className={tallyValueCls}>{stats.totalFiles}</span>
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className={tallyLabelCls}>events</span>
              <span className={tallyValueCls}>
                {stats.totalEvents.toLocaleString()}
              </span>
            </div>
            <div className="flex max-w-[240px] min-w-0 flex-col gap-0.5">
              <span className={tallyLabelCls}>hottest</span>
              <span className={tallyValueCls}>
                {basename(stats.topFile.path)}{" "}
                <span className="ml-1 text-[0.74rem] text-brass">
                  ×{stats.topFile.count}
                </span>
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
                className="pointer-events-none"
              >
                {sys.label}
              </text>

              {sys.bodies.map((b, i) => (
                <g
                  key={i}
                  onMouseEnter={(e) => {
                    const rect = containerRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    setHover({
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top,
                      body: b,
                    });
                  }}
                  onMouseMove={(e) => {
                    const rect = containerRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    setHover({
                      x: e.clientX - rect.left,
                      y: e.clientY - rect.top,
                      body: b,
                    });
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
                      className="pointer-events-none"
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

      <div className={clsx(overlayCls, "bottom-4 left-4 max-w-[220px]")}>
        <div className="mb-2 font-display text-[1rem] text-brass italic">
          legend
        </div>
        <div className="mb-2 leading-[1.6]">
          inner orbit · hottest
          <br />
          larger body · more accesses
        </div>
        <div className="mt-1 border-t border-rule pt-2">
          <div className="mb-1 text-ink-mute">systems</div>
          {allSystems.map((s) => (
            <button
              key={s.workdir}
              className={clsx(
                "block w-full rounded-[3px] px-1.5 py-1 text-left font-mono text-meta text-ink hover:bg-brass/8 hover:text-brass",
                filterProject === s.workdir && "bg-brass/12 text-brass",
              )}
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

      <div className={clsx(overlayCls, "right-4 bottom-4 max-w-[260px]")}>
        <div className="mb-1.5 flex gap-1">
          <Btn
            className="flex-1"
            onClick={() => zoomCentered(1.4)}
            title="zoom in"
          >
            +
          </Btn>
          <Btn
            className="flex-1"
            onClick={() => zoomCentered(1 / 1.4)}
            title="zoom out"
          >
            −
          </Btn>
        </div>
        {filterProject && (
          <Btn className="mb-1.5 w-full" onClick={() => setFilterProject("")}>
            show all
          </Btn>
        )}
        <Btn className="w-full" onClick={resetView}>
          reset view
        </Btn>
      </div>

      {hover && (
        <div
          className="pointer-events-none absolute z-10 max-w-[420px] rounded border border-brass-dim bg-[rgba(5,6,10,0.96)] px-3 py-2 font-mono text-meta"
          style={{ left: hover.x + 12, top: hover.y + 12 }}
        >
          <div className="break-all text-ink">{hover.body.path}</div>
          <div className="mt-[3px] text-tiny text-brass">
            {hover.body.count} events
          </div>
        </div>
      )}
    </div>
  );
}
