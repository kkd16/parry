import { useEffect, useState } from "react";
import { Bell, Copy, Send } from "lucide-react";
import PageHeader from "./components/PageHeader";
import { useToast } from "./components/Toasts";
import type { Event } from "./types";
import type { PolicyOverviewState } from "./usePolicyOverview";
import { formatAbsolute, formatRelative, useNowTick } from "./utils/relativeTime";

interface ProviderField {
  key: string;
  required: boolean;
  default?: string;
  desc: string;
}

interface ProviderSpec {
  id: string;
  name: string;
  desc: string;
  works: string;
  fields: ProviderField[];
  yaml: string;
}

const PROVIDERS: ProviderSpec[] = [
  {
    id: "system",
    name: "System Dialog",
    desc: "Native OS prompt. Local only.",
    works: "macOS osascript, Linux zenity or kdialog.",
    fields: [],
    yaml: `notifications:
  provider: system
  confirmation_timeout: 5m`,
  },
  {
    id: "ntfy",
    name: "ntfy.sh",
    desc: "Push to phone or desktop. Approve from anywhere.",
    works: "Posts to a topic, polls for approve / deny reply.",
    fields: [
      {
        key: "topic",
        required: true,
        desc: "Unique, hard to guess. Anyone with it can approve.",
      },
      {
        key: "server",
        required: false,
        default: "https://ntfy.sh",
        desc: "Self-hosted URL, optional.",
      },
    ],
    yaml: `notifications:
  provider: ntfy
  confirmation_timeout: 5m
  ntfy:
    topic: parry-yourtopicid
    server: https://ntfy.sh`,
  },
];

interface Props {
  overview: PolicyOverviewState;
  onGoToEvents: () => void;
}

interface TestResult {
  ok: boolean;
  error?: string;
  sent_at?: string;
}

function CopyBlock({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="notify-yaml">
      <pre>{text}</pre>
      <button
        className="notify-yaml-copy"
        onClick={() => {
          void navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
      >
        <Copy size={11} />
        {copied ? "copied" : "copy"}
      </button>
    </div>
  );
}

function CopyValue({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return <span className="muted">—</span>;
  return (
    <span className="notify-copy-value">
      <span>{value}</span>
      <button
        className="notify-copy-btn"
        onClick={() => {
          void navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1200);
        }}
      >
        {copied ? "copied" : "copy"}
      </button>
    </span>
  );
}

export default function NotifyPage({ overview, onGoToEvents }: Props) {
  const toast = useToast();
  const { policy, health } = overview;
  const [recent, setRecent] = useState<Event[]>([]);
  const [testing, setTesting] = useState(false);
  const nowTick = useNowTick(30_000);

  useEffect(() => {
    fetch("/api/events?action=confirm&limit=10")
      .then((r) => r.json())
      .then((data: { events?: Event[] }) => setRecent(data.events ?? []))
      .catch(() => {
        // best effort
      });
  }, []);

  const status = health?.status ?? "unconfigured";
  const orbClass =
    status === "ok" ? "ok" : status === "error" ? "err" : "none";
  const statusText =
    status === "ok" ? "connected" : status === "error" ? "unreachable" : "unconfigured";

  const providerId = policy?.notifications?.provider ?? "";
  const cfg = (policy?.notifications?.extra ?? {}) as Record<string, unknown>;
  const ntfy = (cfg["ntfy"] ?? {}) as Record<string, unknown>;
  const topic =
    (typeof ntfy["topic"] === "string" ? (ntfy["topic"] as string) : "") ||
    health?.topic ||
    "";
  const server =
    (typeof ntfy["server"] === "string" ? (ntfy["server"] as string) : "") ||
    health?.server ||
    "";
  const timeout = policy?.notifications?.confirmation_timeout ?? "5m";

  const runTest = async () => {
    if (testing) return;
    setTesting(true);
    try {
      const res = await fetch("/api/notify/test", { method: "POST" });
      const data: TestResult = await res.json();
      if (data.ok) {
        toast.success("test sent", `via ${providerId || "provider"}`);
      } else {
        toast.error("test failed", data.error ?? "unknown");
      }
    } catch (e) {
      toast.error("test failed", String(e));
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      <div className="notify-hero">
        <PageHeader
          eyebrow="instrument · 04"
          title="Beacon"
          sub="push approvals for risky tool calls"
        />
        <div className="notify-hero-status">
          <div className={`notify-orb ${orbClass}`}>
            <Bell size={26} />
          </div>
          <div className="notify-hero-meta">
            <div className="notify-hero-provider">
              {providerId || "none"} <span className="notify-hero-dot">·</span>{" "}
              <span className={`notify-hero-state ${orbClass}`}>{statusText}</span>
            </div>
            {health?.error && <div className="notify-hero-error">{health.error}</div>}
            <button
              className="btn notify-test-btn"
              onClick={runTest}
              disabled={!policy?.notifications?.provider || testing}
            >
              <Send /> {testing ? "sending…" : "send test"}
            </button>
          </div>
        </div>
      </div>

      <div className="notify-grid">
        <div className="notify-card">
          <div className="notify-card-eyebrow">active configuration</div>
          <div className="notify-config-rows">
            <div className="notify-config-row">
              <span className="notify-config-label">provider</span>
              <span className="notify-config-value">{providerId || "—"}</span>
            </div>
            <div className="notify-config-row">
              <span className="notify-config-label">timeout</span>
              <span className="notify-config-value">{timeout}</span>
            </div>
            {providerId === "ntfy" && (
              <>
                <div className="notify-config-row">
                  <span className="notify-config-label">topic</span>
                  <CopyValue value={topic} />
                </div>
                <div className="notify-config-row">
                  <span className="notify-config-label">server</span>
                  <CopyValue value={server || "https://ntfy.sh"} />
                </div>
              </>
            )}
          </div>
          <div className="notify-config-foot">
            on timeout, falls back to <span className="mono">check_mode_confirm</span>.
          </div>
        </div>

        <div className="notify-card">
          <div className="notify-card-eyebrow">recent confirmations</div>
          {recent.length === 0 ? (
            <div className="muted notify-empty">no confirmation events yet.</div>
          ) : (
            <table className="notify-recent">
              <tbody>
                {recent.map((e) => (
                  <tr key={e.id} onClick={onGoToEvents}>
                    <td className="mono nowrap" title={formatAbsolute(e.timestamp)}>
                      {formatRelative(e.timestamp, nowTick)}
                    </td>
                    <td className="mono">{e.binary || e.tool_name}</td>
                    <td className="mono muted notify-recent-input">
                      {(e.tool_input?.["command"] as string | undefined) ??
                        JSON.stringify(e.tool_input).slice(0, 60)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="notify-catalog-eyebrow">provider catalog</div>
      <div className="notify-catalog">
        {PROVIDERS.map((p) => (
          <div
            key={p.id}
            className={`notify-provider${providerId === p.id ? " active" : ""}`}
          >
            <div className="notify-provider-head">
              <h3 className="notify-provider-name">{p.name}</h3>
              {providerId === p.id && (
                <span className="notify-provider-active-tag">active</span>
              )}
            </div>
            <div className="notify-provider-desc">{p.desc}</div>
            <div className="notify-provider-works">{p.works}</div>

            {p.fields.length > 0 && (
              <table className="notify-fields">
                <thead>
                  <tr>
                    <th>field</th>
                    <th>required</th>
                    <th>default</th>
                    <th>description</th>
                  </tr>
                </thead>
                <tbody>
                  {p.fields.map((f) => (
                    <tr key={f.key}>
                      <td className="mono">{f.key}</td>
                      <td>{f.required ? "yes" : "no"}</td>
                      <td className="mono muted">{f.default ?? "—"}</td>
                      <td>{f.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="notify-provider-yaml-label">setup snippet</div>
            <CopyBlock text={p.yaml} />
          </div>
        ))}
      </div>

      <div className="notify-footer">
        change provider with <span className="mono">parry config notify</span>.
      </div>
    </>
  );
}
