import { useMemo, useState } from "react";
import clsx from "clsx";
import { ChevronRight, Eraser, Search } from "lucide-react";
import PageHeader from "./components/PageHeader";
import ShellRulesBoard from "./components/ShellRulesBoard";
import RuleDrawer from "./components/RuleDrawer";
import PolicyDrill from "./components/PolicyDrill";
import { actionBadge } from "./policyBadges";
import {
  Badge,
  ErrorBox,
  FieldLabel,
  FieldValue,
  inputCls,
} from "./components/ui";
import { highlight } from "./highlight";
import { actionClusters, chipMatches } from "./utils/policyView";
import type { PolicyOverviewState } from "./hooks/usePolicyOverview";
import { openUrl, useUrlParam } from "./hooks/useUrlState";
import { useRegisterCommands, type Command } from "./commands";

interface SectionProps {
  title: string;
  count?: number;
  lead?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function Section({
  title,
  count,
  lead,
  defaultOpen = true,
  children,
}: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-md border border-rule bg-bg-raised">
      <button
        className="flex w-full items-center gap-3 px-5.5 py-4 text-left text-ink hover:bg-bg-hover"
        onClick={() => setOpen((v) => !v)}
      >
        <ChevronRight
          size={16}
          className={clsx(
            "text-ink-mute transition-transform duration-200",
            open && "rotate-90",
          )}
        />
        <span className="flex-1 font-display text-[1.3rem] text-ink italic">
          {title}
        </span>
        {count != null && (
          <span className="font-mono text-[0.7rem] text-ink-mute">{count}</span>
        )}
      </button>
      {open && (
        <div className="border-t border-rule-soft px-5.5 pt-2 pb-5.5">
          {lead && (
            <p className="mt-1 mb-3.5 max-w-[62ch] font-display text-[0.92rem] leading-[1.6] text-ink-mute italic">
              {lead}
            </p>
          )}
          {children}
        </div>
      )}
    </div>
  );
}

function PathList({ paths, query }: { paths: string[]; query: string }) {
  return (
    <ul className="font-mono text-[0.76rem] leading-[1.9] text-ink">
      {paths.map((p) => (
        <li key={p} className="before:text-brass before:content-['·_']">
          {highlight(p, query)}
        </li>
      ))}
    </ul>
  );
}

export default function PolicyPage({
  policy,
  loading,
  error,
}: PolicyOverviewState) {
  const [query, setQuery] = useUrlParam("q", "");
  const [openBinary, setOpenBinary] = useState<string | null>(null);

  const goBinary = (b: string) =>
    openUrl("/logbook?binary=" + encodeURIComponent(b));

  const charterCommands = useMemo<Command[]>(
    () => [
      {
        id: "charter.search",
        group: "Charter",
        label: "Focus charter search",
        icon: <Search />,
        perform: () => {
          const el = document.querySelector(
            ".policy-search",
          ) as HTMLInputElement | null;
          el?.focus();
        },
      },
      {
        id: "charter.clear-search",
        group: "Charter",
        label: "Clear charter search",
        icon: <Eraser />,
        perform: () => setQuery(""),
      },
    ],
    [setQuery],
  );
  useRegisterCommands(charterCommands, [charterCommands]);

  const matchesQuery = (s: string | undefined | null) =>
    !query || (s ?? "").toLowerCase().includes(query.toLowerCase());

  const shellRule = policy?.rules["shell"];
  const clusters = useMemo(
    () => (shellRule ? actionClusters(shellRule) : null),
    [shellRule],
  );

  if (loading) {
    return (
      <>
        <PageHeader eyebrow="instrument · 03" title="Charter" />
        <div className="p-10 text-center text-ink-mute italic">
          loading policy…
        </div>
      </>
    );
  }
  if (error) return <ErrorBox>{error}</ErrorBox>;
  if (!policy) return null;

  const shellCount = clusters
    ? Object.values(clusters)
        .flat()
        .filter((c) => chipMatches(c, query))
        .reduce((a, c) => a + c.count, 0)
    : 0;
  const protectedPaths = (policy.protected_paths ?? []).filter((p) =>
    matchesQuery(p),
  );
  const parryPaths = (policy.parry_paths ?? []).filter((p) => matchesQuery(p));
  const shellDefault = shellRule?.default_action ?? policy.default_action;

  return (
    <>
      <PageHeader
        eyebrow="instrument · 03"
        title="Charter"
        sub="your policy.yaml"
      />

      <input
        className={clsx("policy-search mb-4.5 max-w-[360px]", inputCls)}
        placeholder="search rules…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="flex flex-col gap-4.5">
        <div className="flex flex-col gap-[9px] rounded-md border border-l-3 border-rule border-l-brass bg-bg-raised px-5.5 py-4.5">
          <p className="max-w-[64ch] font-display text-[1.02rem] leading-[1.6] text-ink-dim italic">
            Running in{" "}
            <Badge
              action={policy.mode === "enforce" ? "block" : "allow"}
              className="mx-0.5 align-[1px]"
            >
              {policy.mode}
            </Badge>
            {policy.mode === "observe"
              ? ": every verdict is logged, none are enforced."
              : ": verdicts are enforced."}
          </p>
          <p className="max-w-[64ch] font-display text-[1.02rem] leading-[1.6] text-ink-dim italic">
            Anything no rule claims falls to{" "}
            <Badge
              action={policy.default_action}
              className="mx-0.5 align-[1px]"
            >
              {policy.default_action}
            </Badge>
            .
          </p>
          <p className="max-w-[64ch] font-display text-[1.02rem] leading-[1.6] text-ink-dim italic">
            When no notifier can reach you, confirm hardens to{" "}
            <Badge
              action={policy.check_mode_confirm}
              className="mx-0.5 align-[1px]"
            >
              {policy.check_mode_confirm}
            </Badge>
            .
          </p>
        </div>

        <Section
          title="Protected Paths"
          count={protectedPaths.length}
          lead="the hard stop: any tool call touching these paths is blocked, no matter what the rules below say"
        >
          {protectedPaths.length ? (
            <PathList paths={protectedPaths} query={query} />
          ) : (
            <span className="text-ink-mute italic">none</span>
          )}
        </Section>

        {shellRule && clusters && (
          <Section
            title="Shell Rules"
            count={shellCount}
            lead={`every shell command resolves to its most specific rule, strictest on ties; compound commands take the strictest stage; unmatched commands fall to ${shellDefault}`}
          >
            <ShellRulesBoard
              clusters={clusters}
              query={query}
              onOpenBinary={setOpenBinary}
            />
          </Section>
        )}

        <Section
          title="Drill"
          lead="a practice run: type a tool call to see the verdict and which rule decides it — nothing is logged or enforced"
        >
          <PolicyDrill onOpenBinary={setOpenBinary} />
        </Section>

        <Section
          title="File Rules"
          lead="file edits and reads outside the protected paths above"
        >
          <div className="flex items-center gap-3 py-2">
            <FieldLabel className="min-w-[180px]">file_edit default</FieldLabel>
            <FieldValue>
              {actionBadge(
                policy.rules["file_edit"]?.default_action ??
                  policy.default_action,
              )}
            </FieldValue>
          </div>
          <div className="flex items-center gap-3 py-2">
            <FieldLabel className="min-w-[180px]">file_read default</FieldLabel>
            <FieldValue>
              {actionBadge(
                policy.rules["file_read"]?.default_action ??
                  policy.default_action,
              )}
            </FieldValue>
          </div>
        </Section>

        <Section
          title="Rate Limit"
          lead="a sliding window per session; even allowed commands count toward it"
        >
          {policy.rate_limit ? (
            <>
              <div className="flex items-center gap-3 py-2">
                <FieldLabel className="min-w-[180px]">Window</FieldLabel>
                <FieldValue>{policy.rate_limit.window}</FieldValue>
              </div>
              <div className="flex items-center gap-3 py-2">
                <FieldLabel className="min-w-[180px]">Max</FieldLabel>
                <FieldValue>{policy.rate_limit.max}</FieldValue>
              </div>
              {policy.rate_limit.on_exceed && (
                <div className="flex items-center gap-3 py-2">
                  <FieldLabel className="min-w-[180px]">On Exceed</FieldLabel>
                  <FieldValue>
                    {actionBadge(policy.rate_limit.on_exceed)}
                  </FieldValue>
                </div>
              )}
            </>
          ) : (
            <span className="text-ink-mute italic">not configured</span>
          )}
        </Section>

        <Section
          title="Parry Paths"
          count={parryPaths.length}
          lead="parry's own files, shielded so an agent cannot rewrite the rules"
          defaultOpen={false}
        >
          {parryPaths.length ? (
            <PathList paths={parryPaths} query={query} />
          ) : (
            <span className="text-ink-mute italic">none</span>
          )}
        </Section>
      </div>

      <RuleDrawer
        binary={openBinary}
        rule={shellRule}
        globalDefault={policy.default_action}
        onClose={() => setOpenBinary(null)}
        onViewLogbook={goBinary}
      />
    </>
  );
}
