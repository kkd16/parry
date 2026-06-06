import { useCallback, useMemo, useState } from "react";
import type { Event } from "../types";
import { getRuleSuggestion } from "../api";
import { useApi } from "../hooks/useApi";
import { actionBadge } from "../policyBadges";
import CopyButton from "./CopyButton";
import Drawer from "./Drawer";
import { useRegisterCommands, type Command } from "../commands";
import "./EventDrawer.css";

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
  return (
    <div className="drawer-field">
      <div className="drawer-field-label">{label}</div>
      <div className="drawer-field-value">
        {value || <span className="muted">—</span>}
        {value && <CopyButton text={value} />}
      </div>
    </div>
  );
}

const SUGGEST_ACTIONS = ["allow", "confirm", "block"] as const;
type SuggestAction = (typeof SUGGEST_ACTIONS)[number];

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
  const api = useApi(
    useCallback(
      (signal: AbortSignal) => getRuleSuggestion(event.id, targetAction, signal),
      [event.id, targetAction],
    ),
  );
  const suggestion = api.loading ? null : api.data;

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
          onChange={(e) => setTargetAction(e.target.value as SuggestAction)}
        >
          {SUGGEST_ACTIONS.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      {api.loading && <div className="rule-suggestion-status">building suggestion…</div>}
      {api.error && <div className="rule-suggestion-error">{api.error}</div>}
      {suggestion && (
        <>
          <div className="rule-suggestion-meta">
            <span>{suggestion.tool}</span>
            {suggestion.duplicate && <span className="rule-suggestion-duplicate">already covered</span>}
          </div>
          {suggestion.warning && <div className="rule-suggestion-warning">{suggestion.warning}</div>}
          <pre className="rule-suggestion-yaml">{suggestion.yaml}</pre>
          <CopyButton
            key={targetAction}
            className="btn"
            text={suggestion.yaml}
            label="copy yaml"
            copiedLabel="copied yaml"
          />
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
        ? SUGGEST_ACTIONS.map((a) => ({
            id: `event.suggest.${a}`,
            group: "Event",
            label: `Suggest ${a} rule`,
            perform: () => setTargetAction(a),
          }))
        : [],
    [event],
  );
  useRegisterCommands(commands, [commands]);

  const filterButtons = [
    { key: "binary", label: `events for ${event?.binary}` },
    { key: "workdir", label: "events in this directory" },
    { key: "session", label: "this session's events" },
  ] as const;

  return (
    <Drawer
      open={!!event}
      onClose={onClose}
      eyebrow={event ? `log entry · #${event.id}` : ""}
      title={event?.tool_name ?? ""}
    >
      {event && (
        <>
          <div className="drawer-field">
            <div className="drawer-field-label">timestamp</div>
            <div className="drawer-field-value">{new Date(event.timestamp).toLocaleString()}</div>
          </div>
          <div className="drawer-field">
            <div className="drawer-field-label">action</div>
            <div className="drawer-field-value">{actionBadge(event.action)}</div>
          </div>
          {event.would_action && (
            <div className="drawer-field">
              <div className="drawer-field-label">would be</div>
              <div className="drawer-field-value">{actionBadge(event.would_action)}</div>
            </div>
          )}
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
            {onApplyFilter &&
              filterButtons.map(
                (b) =>
                  event[b.key] && (
                    <button
                      key={b.key}
                      className="btn"
                      onClick={() => {
                        onApplyFilter(b.key, event[b.key]);
                        onClose();
                      }}
                    >
                      {b.label}
                    </button>
                  ),
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
        </>
      )}
    </Drawer>
  );
}
