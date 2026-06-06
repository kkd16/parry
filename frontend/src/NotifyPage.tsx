import { useCallback, useState, type ReactNode } from "react";
import clsx from "clsx";
import { Bell, Copy, Send } from "lucide-react";
import CopyButton from "./components/CopyButton";
import PageHeader from "./components/PageHeader";
import { useToast } from "./components/Toasts";
import {
  Btn,
  Card,
  chipBtnCls,
  Eyebrow,
  FieldLabel,
  FieldValue,
  Muted,
} from "./components/ui";
import { healthClass } from "./components/variants";
import { getEvents, postNotifyTest } from "./api";
import { shortJson } from "./utils/eventsExport";
import { useApi } from "./hooks/useApi";
import type { PolicyOverviewState } from "./hooks/usePolicyOverview";
import {
  formatAbsolute,
  formatRelative,
  useNowTick,
} from "./utils/relativeTime";

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
  policyOverview: PolicyOverviewState;
  onGoToEvents: () => void;
}

const ORB_CLS: Record<string, string> = {
  ok: "border border-allow bg-allow/12 text-allow shadow-[0_0_28px_color-mix(in_srgb,var(--color-allow)_20%,transparent)]",
  err: "border border-block bg-block/12 text-block shadow-[0_0_28px_color-mix(in_srgb,var(--color-block)_20%,transparent)]",
  none: "border border-ink-mute bg-ink-mute/8 text-ink-mute after:animate-none",
};

const STATE_CLS: Record<string, string> = {
  ok: "text-allow",
  err: "text-block",
  none: "text-ink-mute",
};

function ConfigRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-dashed border-rule-soft pb-2 last:border-b-0 last:pb-0">
      <FieldLabel className="min-w-22.5">{label}</FieldLabel>
      {children}
    </div>
  );
}

function CopyBlock({ text }: { text: string }) {
  return (
    <div className="relative rounded border border-rule bg-bg px-4 py-3.5">
      <pre className="text-meta leading-relaxed whitespace-pre-wrap text-ink">
        {text}
      </pre>
      <CopyButton
        className={clsx("absolute top-2 right-2 bg-bg-raised", chipBtnCls)}
        text={text}
        label={
          <>
            <Copy size={11} />
            copy
          </>
        }
        copiedLabel={
          <>
            <Copy size={11} />
            copied
          </>
        }
      />
    </div>
  );
}

function CopyValue({ value }: { value: string }) {
  if (!value) return <Muted />;
  return (
    <span className="inline-flex items-center gap-2 break-all text-ink">
      <span>{value}</span>
      <CopyButton className={chipBtnCls} text={value} />
    </span>
  );
}

export default function NotifyPage({ policyOverview, onGoToEvents }: Props) {
  const toast = useToast();
  const { policy, health } = policyOverview;
  const [testing, setTesting] = useState(false);
  const nowTick = useNowTick(30_000);

  const recentApi = useApi(
    useCallback(
      (signal: AbortSignal) =>
        getEvents(
          new URLSearchParams({ action: "confirm", limit: "10" }),
          signal,
        ),
      [],
    ),
  );
  const recent = recentApi.data?.events ?? [];

  const status = health?.status ?? "unconfigured";
  const orbClass = healthClass(status);
  const statusText =
    status === "ok"
      ? "connected"
      : status === "error"
        ? "unreachable"
        : "unconfigured";

  const providerId = policy?.notifications?.provider ?? "";
  const ntfy = policy?.notifications?.extra?.ntfy;
  const topic = ntfy?.topic || health?.topic || "";
  const server = ntfy?.server || health?.server || "";
  const timeout = policy?.notifications?.confirmation_timeout ?? "5m";

  const runTest = async () => {
    if (testing) return;
    setTesting(true);
    try {
      const data = await postNotifyTest();
      if (data.ok) {
        toast.success("test sent", `via ${providerId || "provider"}`);
      } else {
        toast.error("test failed", data.error ?? "unknown");
      }
    } catch (e) {
      toast.error("test failed", e instanceof Error ? e.message : String(e));
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      <div className="mb-8 flex items-end justify-between gap-8">
        <PageHeader
          eyebrow="instrument · 04"
          title="Beacon"
          sub="push approvals for risky tool calls"
          flush
          className="flex-1"
        />
        <div className="flex min-w-80 items-center gap-5.5 rounded-md border border-l-3 border-rule border-l-brass bg-bg-raised px-6.5 py-5.5">
          <div
            className={clsx(
              "relative flex size-16 shrink-0 items-center justify-center rounded-full after:absolute after:-inset-1.5 after:animate-orb-pulse after:rounded-full after:border after:border-current after:opacity-25 after:content-['']",
              ORB_CLS[orbClass],
            )}
          >
            <Bell size={26} />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="font-display text-2xl leading-[1.1] text-ink italic">
              {providerId || "none"}{" "}
              <span className="mx-1 text-ink-mute">·</span>{" "}
              <span
                className={clsx(
                  "font-mono text-meta tracking-label uppercase not-italic",
                  STATE_CLS[orbClass],
                )}
              >
                {statusText}
              </span>
            </div>
            {health?.error && (
              <div className="mb-1 text-meta text-block">{health.error}</div>
            )}
            <Btn
              className="mt-1 self-start disabled:cursor-not-allowed disabled:opacity-40"
              onClick={runTest}
              disabled={!policy?.notifications?.provider || testing}
            >
              <Send /> {testing ? "sending…" : "send test"}
            </Btn>
          </div>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4">
        <Card>
          <Eyebrow>active configuration</Eyebrow>
          <div className="flex flex-col gap-2.5 text-body">
            <ConfigRow label="provider">
              <FieldValue className="break-all">{providerId || "—"}</FieldValue>
            </ConfigRow>
            <ConfigRow label="timeout">
              <FieldValue className="break-all">{timeout}</FieldValue>
            </ConfigRow>
            {providerId === "ntfy" && (
              <>
                <ConfigRow label="topic">
                  <CopyValue value={topic} />
                </ConfigRow>
                <ConfigRow label="server">
                  <CopyValue value={server || "https://ntfy.sh"} />
                </ConfigRow>
              </>
            )}
          </div>
          <div className="mt-3.5 border-t border-rule-soft pt-3 text-tiny leading-relaxed text-ink-mute">
            on timeout, falls back to{" "}
            <span className="text-body">check_mode_confirm</span>.
          </div>
        </Card>

        <Card>
          <Eyebrow>recent confirmations</Eyebrow>
          {recent.length === 0 ? (
            <div className="px-1 py-4.5 font-display text-base text-ink-mute italic">
              no confirmation events yet.
            </div>
          ) : (
            <table className="w-full border-collapse text-meta [&_td]:p-2">
              <tbody>
                {recent.map((e) => (
                  <tr
                    key={e.id}
                    className="cursor-pointer border-b border-rule-soft hover:bg-bg-hover"
                    onClick={onGoToEvents}
                  >
                    <td
                      className="text-body whitespace-nowrap"
                      title={formatAbsolute(e.timestamp)}
                    >
                      {formatRelative(e.timestamp, nowTick)}
                    </td>
                    <td className="text-body">{e.binary || e.tool_name}</td>
                    <td className="w-full max-w-0 truncate text-body text-ink-mute italic">
                      {(e.tool_input?.["command"] as string | undefined) ??
                        shortJson(e.tool_input, 60)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>

      <Eyebrow className="flex items-center gap-2.5 after:h-px after:flex-1 after:bg-[linear-gradient(90deg,var(--color-brass)_0%,transparent_100%)] after:opacity-35 after:content-['']">
        provider catalog
      </Eyebrow>
      <div className="mb-8 grid grid-cols-2 gap-4">
        {PROVIDERS.map((p) => (
          <div
            key={p.id}
            className={clsx(
              "flex flex-col gap-3 rounded-md border border-l-3 border-rule bg-bg-raised px-6 py-5.5 shadow-panel",
              providerId === p.id &&
                "border-l-brass-bright ring-1 ring-brass/8",
            )}
          >
            <div className="flex items-baseline gap-3">
              <h3 className="font-display text-[1.7rem] leading-none text-ink italic">
                {p.name}
              </h3>
              {providerId === p.id && (
                <span className="rounded-sm border border-brass-dim bg-brass/12 px-2 py-0.5 text-eyebrow tracking-eyebrow text-brass-bright uppercase">
                  active
                </span>
              )}
            </div>
            <div className="text-sm leading-normal text-ink">{p.desc}</div>
            <div className="rounded-r border-l border-brass-dim bg-bg px-3 py-2.5 text-meta leading-relaxed text-ink-dim">
              {p.works}
            </div>

            {p.fields.length > 0 && (
              <table className="mt-1 w-full border-collapse text-meta [&_td]:border-b [&_td]:border-rule-soft [&_td]:p-2 [&_td]:align-top [&_td]:text-ink [&_th]:border-b [&_th]:border-rule [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:text-eyebrow [&_th]:font-semibold [&_th]:tracking-label [&_th]:text-ink-mute [&_th]:uppercase">
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
                      <td className="text-brass">{f.key}</td>
                      <td>{f.required ? "yes" : "no"}</td>
                      <td className="italic">{f.default ?? "—"}</td>
                      <td>{f.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="mt-1 text-eyebrow tracking-eyebrow text-ink-mute uppercase">
              setup snippet
            </div>
            <CopyBlock text={p.yaml} />
          </div>
        ))}
      </div>

      <div className="border-t border-dashed border-rule pt-4.5 pb-2 text-center font-display text-base text-ink-dim italic">
        change provider with{" "}
        <span className="font-mono text-body text-brass not-italic">
          parry config notify
        </span>
        .
      </div>
    </>
  );
}
