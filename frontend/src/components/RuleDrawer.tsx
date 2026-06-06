import { motion, AnimatePresence } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import type { Event, EventsResponse, Rule } from "../types";
import { actionBadge } from "../policyBadges";
import { formatRelative, useNowTick } from "../utils/relativeTime";
import {
  explainBinary,
  STRICTNESS,
  type ActionName,
  type BinaryExplanation,
} from "../utils/policyView";

const PHRASE: Record<ActionName, string> = {
  allow: "runs without interruption",
  confirm: "pauses for your approval",
  block: "is refused",
};

function Verdict({ x }: { x: BinaryExplanation }) {
  const rows = x.rows;
  if (rows.length === 1) {
    const r = rows[0];
    if (r.specificity === 0) {
      return (
        <p className="rule-verdict">
          Every <code>{x.binary}</code> command {PHRASE[r.action]}.
        </p>
      );
    }
    return (
      <p className="rule-verdict">
        <code>{r.label}</code> {PHRASE[r.action]}; any other <code>{x.binary}</code> command falls
        to the shell default, {actionBadge(x.shellDefault)}.
      </p>
    );
  }
  const top = rows[0];
  const bare = rows.find((r) => r.specificity === 0);
  if (bare && bare !== top && rows.length === 2) {
    const word = STRICTNESS[top.action] > STRICTNESS[bare.action] ? "escalates" : "relaxes";
    return (
      <p className="rule-verdict">
        <code>{x.binary}</code> {PHRASE[bare.action]} by default, but <code>{top.label}</code>{" "}
        {word} to {actionBadge(top.action)} because the more specific rule wins.
      </p>
    );
  }
  return (
    <p className="rule-verdict">
      {rows.length} rules govern <code>{x.binary}</code>; the most specific match decides
      {x.actions.length > 1 ? ", strictest on ties" : ""}. Anything unmatched falls to the shell
      default, {actionBadge(x.shellDefault)}.
    </p>
  );
}

function CopyButton({ text, label = "copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="btn"
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }}
    >
      {copied ? "copied" : label}
    </button>
  );
}

function RecentActivity({
  binary,
  onViewLogbook,
}: {
  binary: string;
  onViewLogbook: (binary: string) => void;
}) {
  const [events, setEvents] = useState<Event[] | null>(null);
  const nowTick = useNowTick(30_000);

  useEffect(() => {
    const ctrl = new AbortController();
    const params = new URLSearchParams({ binary, limit: "5" });
    fetch(`/api/events?${params}`, { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error(res.statusText);
        return res.json() as Promise<EventsResponse>;
      })
      .then((data) => setEvents(data.events ?? []))
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setEvents([]);
      });
    return () => ctrl.abort();
  }, [binary]);

  return (
    <section className="rule-drawer-section">
      <div className="drawer-field-label">recent activity</div>
      {events === null && <div className="muted rule-activity-empty">loading…</div>}
      {events?.length === 0 && (
        <div className="muted rule-activity-empty">no logged calls to {binary} yet</div>
      )}
      {!!events?.length && (
        <ul className="rule-activity">
          {events.map((e) => {
            const cmd = typeof e.tool_input.command === "string" ? e.tool_input.command : e.file;
            return (
              <li key={e.id}>
                <span className="rule-activity-time">{formatRelative(e.timestamp, nowTick)}</span>
                {actionBadge(e.action)}
                <span className="rule-activity-cmd mono" title={cmd}>
                  {cmd}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="drawer-actions">
        <button className="btn" onClick={() => onViewLogbook(binary)}>
          view all in logbook
        </button>
      </div>
    </section>
  );
}

interface Props {
  binary: string | null;
  rule: Rule | undefined;
  globalDefault: string;
  onClose: () => void;
  onViewLogbook: (binary: string) => void;
}

export default function RuleDrawer({ binary, rule, globalDefault, onClose, onViewLogbook }: Props) {
  const x = useMemo(
    () => (binary && rule ? explainBinary(binary, rule, globalDefault) : null),
    [binary, rule, globalDefault],
  );

  useEffect(() => {
    if (!binary) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [binary, onClose]);

  return (
    <AnimatePresence>
      {binary && x && (
        <>
          <motion.div
            className="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.aside
            className="drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
          >
            <div className="drawer-header">
              <div>
                <div className="drawer-eyebrow">shell rule</div>
                <h2 className="drawer-title">{binary}</h2>
              </div>
              <button className="drawer-close" onClick={onClose}>
                close · esc
              </button>
            </div>
            <div className="drawer-body">
              <Verdict x={x} />

              <section className="rule-drawer-section">
                <div className="drawer-field-label">precedence</div>
                <div className="rule-ladder">
                  {x.rows.map((r) => (
                    <div className="rule-ladder-row" key={r.label + r.action}>
                      <span className="rule-ladder-label mono">{r.label}</span>
                      <span className="rule-ladder-meta">
                        {actionBadge(r.action)}
                        <span className="rule-ladder-spec" title="specificity: positional + flags">
                          {r.specificity}
                        </span>
                      </span>
                      <span className="rule-ladder-reason">{r.reason}</span>
                    </div>
                  ))}
                  <div className="rule-ladder-row rule-ladder-default">
                    <span className="rule-ladder-label mono">anything else</span>
                    <span className="rule-ladder-meta">{actionBadge(x.shellDefault)}</span>
                    <span className="rule-ladder-reason">shell default</span>
                  </div>
                </div>
              </section>

              <section className="rule-drawer-section">
                <div className="drawer-field-label">how matching works</div>
                <ul className="rule-match-notes">
                  <li>
                    the command's binary must be exactly <code>{binary}</code> — path prefixes like{" "}
                    <code>/bin/{binary}</code> resolve to the same rule
                  </li>
                  {x.rows.some((r) => r.label.split(" ").length > 1 && !r.label.includes("[")) && (
                    <li>
                      positional words match as an ordered prefix: extra arguments after them do
                      not change the verdict
                    </li>
                  )}
                  {x.flagForms.length > 0 && (
                    <li>
                      flags in rules are semantic names — every spelling listed below triggers the
                      rule, in any order or bundling
                    </li>
                  )}
                </ul>
              </section>

              {x.flagForms.length > 0 && (
                <section className="rule-drawer-section">
                  <div className="drawer-field-label">flag equivalents</div>
                  <div className="rule-flag-table">
                    {x.flagForms.map((f) => (
                      <div className="rule-flag-row" key={f.name}>
                        <span className="rule-flag-name">{f.name}</span>
                        <span className="rule-flag-forms mono">{f.forms.join("  ")}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <section className="rule-drawer-section">
                <div className="drawer-field-label">examples — illustrative, not exhaustive</div>
                <ul className="rule-examples">
                  {x.examples.map((ex) => (
                    <li key={ex.command}>
                      <span className="rule-example-cmd mono">{ex.command}</span>
                      <span className="rule-example-verdict">
                        {actionBadge(ex.action)}
                        <span className="rule-example-via">{ex.via}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rule-drawer-section">
                <div className="drawer-field-label">as written in policy.yaml</div>
                <pre className="rule-suggestion-yaml">{x.yaml}</pre>
                <div className="drawer-actions">
                  <CopyButton text={x.yaml} label="copy yaml" />
                </div>
              </section>

              <RecentActivity key={binary} binary={binary} onViewLogbook={onViewLogbook} />

              <div className="rule-drawer-footer" />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
