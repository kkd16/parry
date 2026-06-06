import PageHeader from "./components/PageHeader";
import { formatAbsolute, formatRelative, useNowTick } from "./utils/relativeTime";
import { basename } from "./utils/format";
import { ACTION_COLORS, actionBadge, healthClass } from "./policyBadges";
import type { ActionCount, DayBucket, Event, OverviewResponse } from "./types";
import type { PolicyOverviewState } from "./hooks/usePolicyOverview";
import "./BridgePage.css";

interface Props {
  policyOverview: PolicyOverviewState;
  overview: OverviewResponse | null;
  error: string | null;
  onEventClick: (e: Event) => void;
  onFilterBinary: (b: string) => void;
}

function Sparkline({ data }: { data: DayBucket[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const w = 220;
  const h = 56;
  const step = w / Math.max(1, data.length - 1);
  const points = data
    .map((d, i) => `${i * step},${h - (d.count / max) * (h - 4) - 2}`)
    .join(" ");
  return (
    <svg width={w} height={h} className="bridge-sparkline">
      <polyline
        points={points}
        fill="none"
        stroke="var(--brass)"
        strokeWidth={1.5}
      />
      {data.map((d, i) => (
        <g key={d.date}>
          <circle
            cx={i * step}
            cy={h - (d.count / max) * (h - 4) - 2}
            r={2}
            fill="var(--brass-bright)"
          />
          <title>{`${d.date}: ${d.count}`}</title>
        </g>
      ))}
    </svg>
  );
}

function Donut({ data }: { data: ActionCount[] }) {
  const total = data.reduce((s, d) => s + d.count, 0) || 1;
  const r = 44;
  const c = 2 * Math.PI * r;
  const segments = data.reduce<{ action: string; dash: number; offset: number }[]>(
    (acc, d) => {
      const dash = (d.count / total) * c;
      const offset = acc.reduce((s, x) => s + x.dash, 0);
      acc.push({ action: d.action, dash, offset });
      return acc;
    },
    [],
  );
  return (
    <div className="bridge-donut-wrap">
      <svg width={120} height={120} viewBox="0 0 120 120">
        <circle cx={60} cy={60} r={r} fill="none" stroke="var(--rule)" strokeWidth={14} />
        {segments.map((s) => (
          <circle
            key={s.action}
            cx={60}
            cy={60}
            r={r}
            fill="none"
            stroke={ACTION_COLORS[s.action] ?? "var(--ink-mute)"}
            strokeWidth={14}
            strokeDasharray={`${s.dash} ${c - s.dash}`}
            strokeDashoffset={-s.offset}
            transform="rotate(-90 60 60)"
          />
        ))}
        <text
          x={60}
          y={62}
          textAnchor="middle"
          fill="var(--ink)"
          fontSize={20}
          fontFamily="Instrument Serif, serif"
          fontStyle="italic"
        >
          {total.toLocaleString()}
        </text>
      </svg>
      <div className="bridge-donut-legend">
        {data.map((d) => (
          <div key={d.action} className="bridge-donut-legend-row">
            <span
              className="bridge-donut-swatch"
              style={{ background: ACTION_COLORS[d.action] ?? "var(--ink-mute)" }}
            />
            <span className="bridge-donut-action">{d.action}</span>
            <span className="bridge-donut-count">{d.count.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionBar({ actions }: { actions: Record<string, number> }) {
  const total = Object.values(actions).reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="bridge-action-bar">
      {Object.entries(actions).map(([a, c]) => (
        <span
          key={a}
          className="bridge-action-bar-seg"
          style={{
            width: `${(c / total) * 100}%`,
            background: ACTION_COLORS[a] ?? "var(--ink-mute)",
          }}
          title={`${a}: ${c}`}
        />
      ))}
    </div>
  );
}

export default function BridgePage({
  policyOverview,
  overview,
  error,
  onEventClick,
  onFilterBinary,
}: Props) {
  const nowTick = useNowTick(30_000);
  const data = overview;
  const policy = policyOverview.policy;
  const health = policyOverview.health;

  return (
    <>
      <PageHeader eyebrow="instrument · 00" title="Bridge" />

      {error && <div className="error">{error}</div>}
      {!data ? (
        <div className="muted" style={{ padding: 40, textAlign: "center" }}>
          assembling the watch report…
        </div>
      ) : (
        <div className="bridge-grid">
          <div className="card bridge-card bridge-card-wide">
            <div className="card-eyebrow">activity</div>
            <div className="bridge-card-row">
              <div>
                <div className="bridge-big-num">{data.today.toLocaleString()}</div>
                <div className="bridge-card-sub">events today</div>
              </div>
              <div style={{ flex: 1 }} />
              <Sparkline data={data.last_7d} />
            </div>
            <div className="bridge-card-foot">
              <span>{data.total.toLocaleString()} total recorded</span>
            </div>
          </div>

          <div className="card bridge-card">
            <div className="card-eyebrow">action distribution</div>
            <Donut data={data.by_action} />
          </div>

          <div className="card bridge-card">
            <div className="card-eyebrow">policy heartbeat</div>
            <div className="bridge-heart">
              <div className="field-row bridge-heart-row">
                <span className="field-label">mode</span>
                <span className="field-value">{policy?.mode ?? "—"}</span>
              </div>
              <div className="field-row bridge-heart-row">
                <span className="field-label">version</span>
                <span className="field-value">{policy?.version ?? "—"}</span>
              </div>
              <div className="field-row bridge-heart-row">
                <span className="field-label">default</span>
                <span className="field-value">{policy?.default_action ?? "—"}</span>
              </div>
              <div className="field-row bridge-heart-row">
                <span className="field-label">notify</span>
                <span className="field-value">
                  <span className={`health-dot ${healthClass(health?.status)}`} />
                  {policy?.notifications?.provider ?? "none"}
                </span>
              </div>
            </div>
          </div>

          <div className="card bridge-card">
            <div className="card-eyebrow">top binaries</div>
            {data.top_binaries.length === 0 ? (
              <div className="muted">no binary calls recorded yet</div>
            ) : (
              <table className="bridge-bin-table">
                <tbody>
                  {data.top_binaries.map((b) => (
                    <tr key={b.binary}>
                      <td>
                        <button className="bridge-bin-link" onClick={() => onFilterBinary(b.binary)}>
                          {b.binary}
                        </button>
                      </td>
                      <td className="bridge-bin-count">{b.count.toLocaleString()}</td>
                      <td className="bridge-bin-bar">
                        <ActionBar actions={b.actions} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="card bridge-card">
            <div className="card-eyebrow">most active project</div>
            {data.top_project ? (
              <>
                <div className="bridge-project-name">{basename(data.top_project.workdir)}</div>
                <div className="bridge-project-path">{data.top_project.workdir}</div>
                <div className="bridge-project-count">
                  {data.top_project.count.toLocaleString()} events
                </div>
              </>
            ) : (
              <div className="muted">no projects yet</div>
            )}
          </div>

          <div className="card bridge-card bridge-card-full">
            <div className="card-eyebrow">recent blocks</div>
            {data.recent_blocks.length === 0 ? (
              <div className="muted" style={{ padding: 12 }}>
                no blocks recorded — clean watch
              </div>
            ) : (
              <table className="bridge-blocks">
                <tbody>
                  {data.recent_blocks.map((e) => (
                    <tr key={e.id} onClick={() => onEventClick(e)}>
                      <td className="mono nowrap" title={formatAbsolute(e.timestamp)}>
                        {formatRelative(e.timestamp, nowTick)}
                      </td>
                      <td>{actionBadge(e.action)}</td>
                      <td className="mono">{e.binary || e.tool_name}</td>
                      <td className="mono muted bridge-blocks-input">
                        {JSON.stringify(e.tool_input).slice(0, 80)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </>
  );
}
