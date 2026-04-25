import { motion, AnimatePresence } from "motion/react";
import { useEffect, useMemo, useState } from "react";
import type { Event, RuleSuggestion } from "../types";
import { actionBadge } from "../policyBadges";
import { useRegisterCommands, type Command } from "../commands";

interface Props {
  event: Event | null;
  onClose: () => void;
  onApplyFilter?: (key: "binary" | "workdir" | "session", value: string) => void;
}

function highlightJson(value: unknown): string {
  const json = JSON.stringify(value, null, 2);
  return json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      (match) => {
        let cls = "json-num";
        if (/^"/.test(match)) {
          cls = /:$/.test(match) ? "json-key" : "json-str";
        } else if (/true|false/.test(match)) {
          cls = "json-bool";
        } else if (/null/.test(match)) {
          cls = "json-null";
        }
        return `<span class="${cls}">${match}</span>`;
      },
    );
}

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="drawer-field">
      <div className="drawer-field-label">{label}</div>
      <div className="drawer-field-value">
        {value || <span className="muted">—</span>}
        {value && (
          <button
            className="copy-btn"
            onClick={() => {
              void navigator.clipboard.writeText(value);
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
          >
            {copied ? "copied" : "copy"}
          </button>
        )}
      </div>
    </div>
  );
}

type SuggestAction = "allow" | "confirm" | "block";

function initialSuggestAction(event: Event | null): SuggestAction {
  if (event?.action === "allow" || event?.action === "confirm" || event?.action === "block") {
    return event.action;
  }
  return "confirm";
}

function RuleSuggestionPanel({
  event,
  targetAction,
  setTargetAction,
}: {
  event: Event;
  targetAction: SuggestAction;
  setTargetAction: (action: SuggestAction) => void;
}) {
  const [suggestion, setSuggestion] = useState<RuleSuggestion | null>(null);
  const [error, setError] = useState<{ action: SuggestAction; message: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const ctrl = new AbortController();
    const params = new URLSearchParams({
      event_id: String(event.id),
      action: targetAction,
    });
    fetch(`/api/rule-suggestion?${params}`, { signal: ctrl.signal })
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.text()) || res.statusText);
        return res.json() as Promise<RuleSuggestion>;
      })
      .then((data) => {
        setSuggestion(data);
        setError(null);
      })
      .catch((e) => {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError({ action: targetAction, message: e instanceof Error ? e.message : "unknown error" });
      });
    return () => ctrl.abort();
  }, [event.id, targetAction]);

  return (
    <section className="rule-suggestion">
      <div className="rule-suggestion-head">
        <div>
          <div className="drawer-field-label">suggest rule</div>
          <div className="rule-suggestion-sub">copy YAML into policy.yaml</div>
        </div>
        <select
          className="input rule-suggestion-select"
          value={targetAction}
          onChange={(e) => {
            setCopied(false);
            setTargetAction(e.target.value as SuggestAction);
          }}
        >
          <option value="allow">allow</option>
          <option value="confirm">confirm</option>
          <option value="block">block</option>
        </select>
      </div>

      {(!suggestion || suggestion.action !== targetAction) && error?.action !== targetAction && (
        <div className="rule-suggestion-status">building suggestion…</div>
      )}
      {error?.action === targetAction && <div className="rule-suggestion-error">{error.message}</div>}
      {suggestion && suggestion.action === targetAction && (
        <>
          <div className="rule-suggestion-meta">
            <span>{suggestion.tool}</span>
            {suggestion.duplicate && <span className="rule-suggestion-duplicate">already covered</span>}
          </div>
          {suggestion.warning && <div className="rule-suggestion-warning">{suggestion.warning}</div>}
          <pre className="rule-suggestion-yaml">{suggestion.yaml}</pre>
          <button
            className="btn"
            onClick={() => {
              void navigator.clipboard.writeText(suggestion.yaml);
              setCopied(true);
              setTimeout(() => setCopied(false), 1200);
            }}
          >
            {copied ? "copied yaml" : "copy yaml"}
          </button>
        </>
      )}
    </section>
  );
}

export default function EventDrawer({ event, onClose, onApplyFilter }: Props) {
  const [targetAction, setTargetAction] = useState<SuggestAction>(() => initialSuggestAction(event));

  const commands = useMemo<Command[]>(
    () =>
      event
        ? [
            {
              id: "event.suggest.allow",
              group: "Event",
              label: "Suggest allow rule",
              perform: () => {
                setTargetAction("allow");
              },
            },
            {
              id: "event.suggest.confirm",
              group: "Event",
              label: "Suggest confirm rule",
              perform: () => {
                setTargetAction("confirm");
              },
            },
            {
              id: "event.suggest.block",
              group: "Event",
              label: "Suggest block rule",
              perform: () => {
                setTargetAction("block");
              },
            },
          ]
        : [],
    [event],
  );
  useRegisterCommands(commands, [commands]);

  return (
    <AnimatePresence>
      {event && (
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
                <div className="drawer-eyebrow">log entry · #{event.id}</div>
                <h2 className="drawer-title">{event.tool_name}</h2>
              </div>
              <button className="drawer-close" onClick={onClose}>
                close · esc
              </button>
            </div>
            <div className="drawer-body">
              <div className="drawer-field">
                <div className="drawer-field-label">timestamp</div>
                <div className="drawer-field-value">{new Date(event.timestamp).toLocaleString()}</div>
              </div>
              <div className="drawer-field">
                <div className="drawer-field-label">action</div>
                <div className="drawer-field-value">{actionBadge(event.action)}</div>
              </div>
              <div className="drawer-field">
                <div className="drawer-field-label">mode</div>
                <div className="drawer-field-value">{event.mode}</div>
              </div>
              <div className="drawer-field">
                <div className="drawer-field-label">raw name</div>
                <div className="drawer-field-value">{event.raw_name || "—"}</div>
              </div>
              <CopyField label="binary" value={event.binary} />
              <CopyField label="file" value={event.file} />
              <CopyField label="workdir" value={event.workdir} />
              <CopyField label="session" value={event.session} />
              <div className="drawer-actions">
                {onApplyFilter && event.binary && (
                  <button
                    className="btn"
                    onClick={() => {
                      onApplyFilter("binary", event.binary);
                      onClose();
                    }}
                  >
                    events for {event.binary}
                  </button>
                )}
                {onApplyFilter && event.workdir && (
                  <button
                    className="btn"
                    onClick={() => {
                      onApplyFilter("workdir", event.workdir);
                      onClose();
                    }}
                  >
                    events in this directory
                  </button>
                )}
              </div>
              <RuleSuggestionPanel
                event={event}
                targetAction={targetAction}
                setTargetAction={setTargetAction}
              />
              <div
                className="drawer-json"
                dangerouslySetInnerHTML={{ __html: highlightJson(event.tool_input) }}
              />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
