import { useMemo, useState } from "react";
import type { Event } from "../types";
import { ACTION_COLORS } from "../policyBadges";

interface Props {
  events: Event[];
}

const BUCKETS = 60;

interface Bucket {
  counts: Record<string, number>;
  total: number;
  start: number;
  end: number;
}

interface Hover {
  idx: number;
  x: number;
}

function formatTimeRange(a: number, b: number): string {
  const da = new Date(a);
  const db = new Date(b);
  const sameDay = da.toDateString() === db.toDateString();
  if (sameDay) {
    return `${da.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })} – ${db.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
  }
  return `${da.toLocaleString()} – ${db.toLocaleString()}`;
}

export default function EventsTimeline({ events }: Props) {
  const [hover, setHover] = useState<Hover | null>(null);

  const data = useMemo(() => {
    if (events.length === 0) return null;
    const times = events.map((e) => new Date(e.timestamp).getTime());
    const min = Math.min(...times);
    const max = Math.max(...times);
    const span = Math.max(1, max - min);
    const bucketMs = span / BUCKETS;
    const buckets: Bucket[] = Array.from({ length: BUCKETS }, (_, i) => ({
      counts: {},
      total: 0,
      start: min + i * bucketMs,
      end: min + (i + 1) * bucketMs,
    }));
    for (const e of events) {
      const t = new Date(e.timestamp).getTime();
      const idx = Math.min(BUCKETS - 1, Math.floor((t - min) / bucketMs));
      const b = buckets[idx];
      b.counts[e.action] = (b.counts[e.action] ?? 0) + 1;
      b.total += 1;
    }
    const peak = Math.max(1, ...buckets.map((b) => b.total));
    const startLabel = new Date(min).toLocaleString();
    const endLabel = new Date(max).toLocaleString();
    return { buckets, peak, startLabel, endLabel };
  }, [events]);

  if (!data) return null;

  const w = 100;
  const h = 70;
  const barW = w / BUCKETS;

  const hoverBucket = hover ? data.buckets[hover.idx] : null;

  return (
    <div className="mb-3.5 rounded-md border border-rule bg-bg-raised px-4 py-3">
      <div className="mb-1.5 font-mono text-eyebrow tracking-[0.18em] text-brass uppercase">
        activity
      </div>
      <div className="relative">
        <svg
          width="100%"
          height={h}
          viewBox={`0 0 ${w} ${h}`}
          preserveAspectRatio="none"
          className="block h-[70px] w-full [&_g]:cursor-crosshair"
          onMouseLeave={() => setHover(null)}
        >
          {data.buckets.map((b, i) => {
            const barH = (b.total / data.peak) * (h - 4);
            let yCursor = h - 2;
            const isHovered = hover?.idx === i;
            return (
              <g
                key={i}
                onMouseEnter={(e) => {
                  const rect = (
                    e.currentTarget.ownerSVGElement as SVGSVGElement
                  ).getBoundingClientRect();
                  setHover({ idx: i, x: e.clientX - rect.left });
                }}
                onMouseMove={(e) => {
                  const rect = (
                    e.currentTarget.ownerSVGElement as SVGSVGElement
                  ).getBoundingClientRect();
                  setHover({ idx: i, x: e.clientX - rect.left });
                }}
              >
                <rect
                  x={i * barW}
                  y={0}
                  width={barW}
                  height={h}
                  fill="transparent"
                />
                {b.total > 0 &&
                  (["allow", "observe", "confirm", "block"] as const).map(
                    (action) => {
                      const c = b.counts[action] ?? 0;
                      if (c === 0) return null;
                      const seg = (c / b.total) * barH;
                      yCursor -= seg;
                      return (
                        <rect
                          key={action}
                          x={i * barW + 0.15}
                          y={yCursor}
                          width={barW - 0.3}
                          height={seg}
                          fill={ACTION_COLORS[action]}
                          opacity={hover && !isHovered ? 0.45 : 1}
                        />
                      );
                    },
                  )}
              </g>
            );
          })}
        </svg>
        {hoverBucket && hover && (
          <div
            className="pointer-events-none absolute bottom-[calc(100%+6px)] z-5 -translate-x-1/2 rounded border border-brass-dim bg-scrim/97 px-3 py-2 font-mono text-meta whitespace-nowrap text-ink shadow-[0_6px_24px_rgba(0,0,0,0.5)]"
            style={{ left: hover.x }}
          >
            <div className="text-tiny text-brass">
              {formatTimeRange(hoverBucket.start, hoverBucket.end)}
            </div>
            <div className="mt-0.5 mb-1.5 text-body text-ink">
              {hoverBucket.total} {hoverBucket.total === 1 ? "event" : "events"}
            </div>
            {hoverBucket.total > 0 && (
              <div className="flex flex-col gap-0.5 border-t border-rule pt-1">
                {(["allow", "confirm", "observe", "block"] as const).map(
                  (a) => {
                    const c = hoverBucket.counts[a] ?? 0;
                    if (c === 0) return null;
                    return (
                      <div
                        key={a}
                        className="flex items-center gap-1.5 text-tiny"
                      >
                        <span
                          className="inline-block h-1.75 w-1.75 rounded-xs"
                          style={{ background: ACTION_COLORS[a] }}
                        />
                        <span className="flex-1 text-ink-dim">{a}</span>
                        <span className="font-medium text-ink">{c}</span>
                      </div>
                    );
                  },
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="mt-1 flex justify-between font-mono text-micro text-ink-mute">
        <span>{data.startLabel}</span>
        <span>{data.endLabel}</span>
      </div>
    </div>
  );
}
