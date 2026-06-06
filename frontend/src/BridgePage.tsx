import PageHeader from "./components/PageHeader";
import {
  formatAbsolute,
  formatRelative,
  useNowTick,
} from "./utils/relativeTime";
import { basename } from "./utils/format";
import { shortJson } from "./utils/eventsExport";
import { ACTION_COLORS, actionBadge } from "./policyBadges";
import {
  Card,
  EmptyState,
  ErrorBox,
  Eyebrow,
  FieldLabel,
  FieldValue,
  HealthDot,
} from "./components/ui";
import type { ActionCount, DayBucket, OverviewResponse } from "./types";
import type { PolicyOverviewState } from "./hooks/usePolicyOverview";

interface Props {
  policyOverview: PolicyOverviewState;
  overview: OverviewResponse | null;
  error: string | null;
  onEventClick: () => void;
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
    <svg width={w} height={h} className="block">
      <polyline
        points={points}
        fill="none"
        stroke="var(--color-brass)"
        strokeWidth={1.5}
      />
      {data.map((d, i) => (
        <g key={d.date}>
          <circle
            cx={i * step}
            cy={h - (d.count / max) * (h - 4) - 2}
            r={2}
            fill="var(--color-brass-bright)"
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
  const segments: { action: string; dash: number; offset: number }[] = [];
  let offset = 0;
  for (const d of data) {
    const dash = (d.count / total) * c;
    segments.push({ action: d.action, dash, offset });
    offset += dash;
  }
  return (
    <div className="flex items-center gap-4">
      <svg width={120} height={120} viewBox="0 0 120 120">
        <circle
          cx={60}
          cy={60}
          r={r}
          fill="none"
          stroke="var(--color-rule)"
          strokeWidth={14}
        />
        {segments.map((s) => (
          <circle
            key={s.action}
            cx={60}
            cy={60}
            r={r}
            fill="none"
            stroke={ACTION_COLORS[s.action] ?? "var(--color-ink-mute)"}
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
          fill="var(--color-ink)"
          fontSize={20}
          fontFamily="Instrument Serif, serif"
          fontStyle="italic"
        >
          {total.toLocaleString()}
        </text>
      </svg>
      <div className="flex flex-1 flex-col gap-1 font-mono text-meta">
        {data.map((d) => (
          <div key={d.action} className="flex items-center gap-2">
            <span
              className="h-2 w-2 rounded-xs"
              style={{
                background: ACTION_COLORS[d.action] ?? "var(--color-ink-mute)",
              }}
            />
            <span className="flex-1 text-ink-dim">{d.action}</span>
            <span className="text-ink">{d.count.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionBar({ actions }: { actions: Record<string, number> }) {
  const total = Object.values(actions).reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-xs bg-bg">
      {Object.entries(actions).map(([a, c]) => (
        <span
          key={a}
          className="h-full"
          style={{
            width: `${(c / total) * 100}%`,
            background: ACTION_COLORS[a] ?? "var(--color-ink-mute)",
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

      {error && <ErrorBox>{error}</ErrorBox>}
      {!data ? (
        <EmptyState>assembling the watch report…</EmptyState>
      ) : (
        <div className="grid grid-cols-3 gap-4">
          <Card className="col-span-2 flex flex-col">
            <Eyebrow>activity</Eyebrow>
            <div className="flex items-end gap-4">
              <div>
                <div className="font-display text-[3.4rem] leading-[0.9] text-ink italic">
                  {data.today.toLocaleString()}
                </div>
                <div className="mt-1.5 font-mono text-meta text-ink-dim">
                  events today
                </div>
              </div>
              <div className="flex-1" />
              <Sparkline data={data.last_7d} />
            </div>
            <div className="mt-3 border-t border-rule-soft pt-2.5 font-mono text-tiny text-ink-mute">
              <span>{data.total.toLocaleString()} total recorded</span>
            </div>
          </Card>

          <Card className="flex flex-col">
            <Eyebrow>action distribution</Eyebrow>
            <Donut data={data.by_action} />
          </Card>

          <Card className="flex flex-col">
            <Eyebrow>policy heartbeat</Eyebrow>
            <div className="flex flex-col gap-2 font-mono text-body">
              <div className="flex items-center justify-between gap-3">
                <FieldLabel>mode</FieldLabel>
                <FieldValue>{policy?.mode ?? "—"}</FieldValue>
              </div>
              <div className="flex items-center justify-between gap-3">
                <FieldLabel>version</FieldLabel>
                <FieldValue>{policy?.version ?? "—"}</FieldValue>
              </div>
              <div className="flex items-center justify-between gap-3">
                <FieldLabel>default</FieldLabel>
                <FieldValue>{policy?.default_action ?? "—"}</FieldValue>
              </div>
              <div className="flex items-center justify-between gap-3">
                <FieldLabel>notify</FieldLabel>
                <FieldValue>
                  <HealthDot status={health?.status} />
                  {policy?.notifications?.provider ?? "none"}
                </FieldValue>
              </div>
            </div>
          </Card>

          <Card className="flex flex-col">
            <Eyebrow>top binaries</Eyebrow>
            {data.top_binaries.length === 0 ? (
              <div className="text-ink-mute italic">
                no binary calls recorded yet
              </div>
            ) : (
              <table className="w-full border-collapse font-mono text-body [&_td]:border-b [&_td]:border-rule-soft [&_td]:p-2">
                <tbody>
                  {data.top_binaries.map((b) => (
                    <tr key={b.binary}>
                      <td>
                        <button
                          className="cursor-pointer text-ink hover:text-brass"
                          onClick={() => onFilterBinary(b.binary)}
                        >
                          {b.binary}
                        </button>
                      </td>
                      <td className="w-[70px] text-right text-ink-dim">
                        {b.count.toLocaleString()}
                      </td>
                      <td className="w-1/2">
                        <ActionBar actions={b.actions} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>

          <Card className="flex flex-col">
            <Eyebrow>most active project</Eyebrow>
            {data.top_project ? (
              <>
                <div className="mb-1 font-display text-[1.6rem] text-ink italic">
                  {basename(data.top_project.workdir)}
                </div>
                <div className="mb-2 font-mono text-meta break-all text-ink-mute">
                  {data.top_project.workdir}
                </div>
                <div className="font-mono text-body text-brass">
                  {data.top_project.count.toLocaleString()} events
                </div>
              </>
            ) : (
              <div className="text-ink-mute italic">no projects yet</div>
            )}
          </Card>

          <Card className="col-span-full flex flex-col">
            <Eyebrow>recent blocks</Eyebrow>
            {data.recent_blocks.length === 0 ? (
              <div className="p-3 text-ink-mute italic">
                no blocks recorded — clean watch
              </div>
            ) : (
              <table className="w-full border-collapse text-body [&_td]:px-2.5 [&_td]:py-1.75">
                <tbody>
                  {data.recent_blocks.map((e) => (
                    <tr
                      key={e.id}
                      className="cursor-pointer border-b border-rule-soft hover:bg-bg-hover"
                      onClick={onEventClick}
                    >
                      <td
                        className="font-mono text-body whitespace-nowrap"
                        title={formatAbsolute(e.timestamp)}
                      >
                        {formatRelative(e.timestamp, nowTick)}
                      </td>
                      <td>{actionBadge(e.action)}</td>
                      <td className="font-mono text-body">
                        {e.binary || e.tool_name}
                      </td>
                      <td className="w-full max-w-0 truncate font-mono text-body text-ink-mute italic">
                        {shortJson(e.tool_input, 80)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      )}
    </>
  );
}
