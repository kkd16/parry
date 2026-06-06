import { useMemo, useState } from "react";
import { ChevronRight, Eraser, Search } from "lucide-react";
import PageHeader from "./components/PageHeader";
import ShellRulesBoard from "./components/ShellRulesBoard";
import RuleDrawer from "./components/RuleDrawer";
import { actionBadge, modeBadge } from "./policyBadges";
import { highlight } from "./highlight";
import { actionClusters, chipMatches } from "./utils/policyView";
import type { PolicyOverviewState } from "./usePolicyOverview";
import { useUrlParam, usePath } from "./hooks/useUrlState";
import { useRegisterCommands, type Command } from "./commands";

interface SectionProps {
  title: string;
  count?: number;
  lead?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function Section({ title, count, lead, defaultOpen = true, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`policy-section${open ? " open" : ""}`}>
      <button className="policy-section-head" onClick={() => setOpen((v) => !v)}>
        <ChevronRight size={16} className="policy-section-chevron" />
        <span className="policy-section-title">{title}</span>
        {count != null && <span className="policy-section-count">{count}</span>}
      </button>
      {open && (
        <div className="policy-section-body">
          {lead && <p className="charter-lead">{lead}</p>}
          {children}
        </div>
      )}
    </div>
  );
}

export default function PolicyPage({ policy, loading, error }: PolicyOverviewState) {
  const [query, setQuery] = useUrlParam("q", "");
  const [openBinary, setOpenBinary] = useState<string | null>(null);
  const [, setPath] = usePath();

  const goBinary = (b: string) => {
    const params = new URLSearchParams();
    params.set("binary", b);
    window.history.replaceState(null, "", "?" + params.toString());
    setPath("/logbook");
  };

  const charterCommands = useMemo<Command[]>(
    () => [
      {
        id: "charter.search",
        group: "Charter",
        label: "Focus charter search",
        icon: <Search />,
        perform: () => {
          const el = document.querySelector(".policy-search") as HTMLInputElement | null;
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
  const clusters = useMemo(() => (shellRule ? actionClusters(shellRule) : null), [shellRule]);

  if (loading) {
    return (
      <>
        <PageHeader eyebrow="instrument · 03" title="Charter" />
        <div className="muted" style={{ padding: 40, textAlign: "center" }}>
          loading policy…
        </div>
      </>
    );
  }
  if (error) return <div className="error">{error}</div>;
  if (!policy) return null;

  const shellCount = clusters
    ? Object.values(clusters)
        .flat()
        .filter((c) => chipMatches(c, query))
        .reduce((a, c) => a + c.count, 0)
    : 0;
  const protectedPaths = (policy.protected_paths ?? []).filter((p) => matchesQuery(p));
  const parryPaths = (policy.parry_paths ?? []).filter((p) => matchesQuery(p));
  const shellDefault = shellRule?.default_action ?? policy.default_action;

  return (
    <>
      <PageHeader eyebrow="instrument · 03" title="Charter" sub="your policy.yaml" />

      <input
        className="input policy-search"
        placeholder="search rules…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginBottom: 18 }}
      />

      <div className="policy-page charter-flow">
        <div className="charter-mode-banner">
          <p>
            Running in {modeBadge(policy.mode)}
            {policy.mode === "observe"
              ? ": every verdict is logged, none are enforced."
              : ": verdicts are enforced."}{" "}
            Anything no rule claims falls to {actionBadge(policy.default_action)}. When no notifier
            can reach you, confirm hardens to {actionBadge(policy.check_mode_confirm)}.
          </p>
        </div>

        <Section
          title="Protected Paths"
          count={protectedPaths.length}
          lead="the hard stop: any tool call touching these paths is blocked, no matter what the rules below say"
        >
          {protectedPaths.length ? (
            <ul className="path-list">
              {protectedPaths.map((p) => (
                <li key={p}>{highlight(p, query)}</li>
              ))}
            </ul>
          ) : (
            <span className="muted">none</span>
          )}
        </Section>

        {shellRule && clusters && (
          <Section
            title="Shell Rules"
            count={shellCount}
            lead={`every shell command resolves to its most specific rule, strictest on ties; compound commands take the strictest stage; unmatched commands fall to ${shellDefault}`}
          >
            <ShellRulesBoard clusters={clusters} query={query} onOpenBinary={setOpenBinary} />
          </Section>
        )}

        <Section title="File Rules" lead="file edits and reads outside the protected paths above">
          <div className="policy-field">
            <span className="policy-label">file_edit default</span>
            <span className="policy-value">
              {actionBadge(policy.rules["file_edit"]?.default_action ?? policy.default_action)}
            </span>
          </div>
          <div className="policy-field">
            <span className="policy-label">file_read default</span>
            <span className="policy-value">
              {actionBadge(policy.rules["file_read"]?.default_action ?? policy.default_action)}
            </span>
          </div>
        </Section>

        <Section
          title="Rate Limit"
          lead="a sliding window per session; even allowed commands count toward it"
        >
          {policy.rate_limit ? (
            <>
              <div className="policy-field">
                <span className="policy-label">Window</span>
                <span className="policy-value">{policy.rate_limit.window}</span>
              </div>
              <div className="policy-field">
                <span className="policy-label">Max</span>
                <span className="policy-value">{policy.rate_limit.max}</span>
              </div>
              {policy.rate_limit.on_exceed && (
                <div className="policy-field">
                  <span className="policy-label">On Exceed</span>
                  <span className="policy-value">{actionBadge(policy.rate_limit.on_exceed)}</span>
                </div>
              )}
            </>
          ) : (
            <span className="muted">not configured</span>
          )}
        </Section>

        <Section
          title="Parry Paths"
          count={parryPaths.length}
          lead="parry's own files, shielded so an agent cannot rewrite the rules"
          defaultOpen={false}
        >
          {parryPaths.length ? (
            <ul className="path-list">
              {parryPaths.map((p) => (
                <li key={p}>{highlight(p, query)}</li>
              ))}
            </ul>
          ) : (
            <span className="muted">none</span>
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
