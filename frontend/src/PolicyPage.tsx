import { useMemo, useState } from "react";
import { ChevronRight, Eraser, Search } from "lucide-react";
import PageHeader from "./components/PageHeader";
import { actionBadge } from "./policyBadges";
import type { Rule, RuleEntry } from "./types";
import type { PolicyOverviewState } from "./usePolicyOverview";
import { useUrlParam, usePath } from "./hooks/useUrlState";
import { useRegisterCommands, type Command } from "./commands";

function formatEntry(entry: RuleEntry): string {
  const parts = [entry.binary];
  if (entry.positional?.length) {
    parts.push(...entry.positional);
  }
  if (entry.flags?.length) {
    parts.push(`[${entry.flags.join(", ")}]`);
  }
  return parts.join(" ");
}

function ruleBindings(rule: Rule): { action: string; entries: RuleEntry[] }[] {
  const rows: { action: string; entries: RuleEntry[] }[] = [];
  if (rule.allow?.length) rows.push({ action: "allow", entries: rule.allow });
  if (rule.confirm?.length) rows.push({ action: "confirm", entries: rule.confirm });
  if (rule.block?.length) rows.push({ action: "block", entries: rule.block });
  return rows;
}

function highlight(text: string, query: string) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="mark">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

interface SectionProps {
  title: string;
  count?: number;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

function Section({ title, count, defaultOpen = true, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`policy-section${open ? " open" : ""}`}>
      <button className="policy-section-head" onClick={() => setOpen((v) => !v)}>
        <ChevronRight size={16} className="policy-section-chevron" />
        <span className="policy-section-title">{title}</span>
        {count != null && <span className="policy-section-count">{count}</span>}
      </button>
      {open && <div className="policy-section-body">{children}</div>}
    </div>
  );
}

export default function PolicyPage({ policy, loading, error }: PolicyOverviewState) {
  const [query, setQuery] = useUrlParam("q", "");
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

  const filteredBindings = useMemo(() => {
    if (!policy) return null;
    const filterRule = (rule: Rule | undefined) => {
      if (!rule) return [];
      return ruleBindings(rule)
        .map(({ action, entries }) => ({
          action,
          entries: query
            ? entries.filter((e) => formatEntry(e).toLowerCase().includes(query.toLowerCase()))
            : entries,
        }))
        .filter((r) => r.entries.length > 0 || matchesQuery(r.action));
    };
    return {
      shell: filterRule(policy.rules["shell"]),
      file_edit: filterRule(policy.rules["file_edit"]),
      file_read: filterRule(policy.rules["file_read"]),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [policy, query]);

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
  if (!policy || !filteredBindings) return null;

  const protectedPaths = (policy.protected_paths ?? []).filter((p) => matchesQuery(p));
  const parryPaths = (policy.parry_paths ?? []).filter((p) => matchesQuery(p));

  return (
    <>
      <PageHeader
        eyebrow="instrument · 03"
        title="Charter"
        sub="your policy.yaml"
      />

      <input
        className="input policy-search"
        placeholder="search rules…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        style={{ marginBottom: 18 }}
      />

      <div className="policy-page">
        <Section title="Defaults" count={2}>
          <div className="policy-field">
            <span className="policy-label">Default Action</span>
            <span className="policy-value">{actionBadge(policy.default_action)}</span>
          </div>
          <div className="policy-field">
            <span className="policy-label">Check-Mode Confirm</span>
            <span className="policy-value">{actionBadge(policy.check_mode_confirm)}</span>
          </div>
        </Section>

        {policy.rules["shell"] && (
          <Section
            title="Shell Rules"
            count={filteredBindings.shell.reduce((a, b) => a + b.entries.length, 0)}
          >
            <div className="policy-field">
              <span className="policy-label">Default Action</span>
              <span className="policy-value">
                {actionBadge(policy.rules["shell"].default_action ?? policy.default_action)}
              </span>
            </div>
            <table className="policy-table">
              <thead>
                <tr>
                  <th>Action</th>
                  <th>Rules</th>
                </tr>
              </thead>
              <tbody>
                {filteredBindings.shell.map(({ action, entries }) => (
                  <tr key={action}>
                    <td>{actionBadge(action)}</td>
                    <td>
                      {entries.map((e, i) => {
                        const text = formatEntry(e);
                        return (
                          <span key={`${e.binary}-${i}`}>
                            {i > 0 && ", "}
                            <button className="cell-link mono" onClick={() => goBinary(e.binary)}>
                              {highlight(text, query)}
                            </button>
                          </span>
                        );
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        <Section title="File Rules">
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

        <Section title="Rate Limit">
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

        <Section title="Protected Paths" count={protectedPaths.length}>
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

        <Section title="Parry Paths" count={parryPaths.length}>
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
    </>
  );
}
