import { useCallback, useMemo, useState } from "react";
import clsx from "clsx";
import type { Event } from "../types";
import { getRuleSuggestion } from "../api";
import { useApi } from "../hooks/useApi";
import { actionBadge } from "../policyBadges";
import CopyButton from "./CopyButton";
import Drawer, { DrawerActions, DrawerField, yamlBlockCls } from "./Drawer";
import { Btn, btnCls, inputCls } from "./ui";
import { useRegisterCommands, type Command } from "../commands";

interface Props {
  event: Event | null;
  onClose: () => void;
  onApplyFilter?: (
    key: "binary" | "workdir" | "session",
    value: string,
  ) => void;
}

const JSON_CLS: Record<string, string> = {
  key: "text-brass",
  str: "text-allow",
  num: "text-confirm",
  bool: "text-block",
  null: "text-ink-mute italic",
};

function highlightJson(value: unknown): string {
  const json = JSON.stringify(value, null, 2);
  return json
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(
      /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      (match) => {
        let cls = JSON_CLS.num;
        if (/^"/.test(match)) {
          cls = /:$/.test(match) ? JSON_CLS.key : JSON_CLS.str;
        } else if (/true|false/.test(match)) {
          cls = JSON_CLS.bool;
        } else if (/null/.test(match)) {
          cls = JSON_CLS.null;
        }
        return `<span class="${cls}">${match}</span>`;
      },
    );
}

function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <DrawerField label={label}>
      {value || <span className="text-ink-mute italic">—</span>}
      {value && <CopyButton text={value} />}
    </DrawerField>
  );
}

const SUGGEST_ACTIONS = ["allow", "confirm", "block"] as const;
type SuggestAction = (typeof SUGGEST_ACTIONS)[number];

function initialSuggestAction(event: Event | null): SuggestAction {
  if (
    event?.action === "allow" ||
    event?.action === "confirm" ||
    event?.action === "block"
  ) {
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
      (signal: AbortSignal) =>
        getRuleSuggestion(event.id, targetAction, signal),
      [event.id, targetAction],
    ),
  );
  const suggestion = api.loading ? null : api.data;

  return (
    <section className="mt-5 rounded border border-rule bg-[linear-gradient(135deg,rgba(212,161,74,0.08),rgba(12,15,20,0.55))] p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <div className="min-w-[100px] pt-[3px] font-mono text-micro tracking-[0.12em] text-ink-mute uppercase">
            suggest rule
          </div>
          <div className="mt-1 font-display text-[0.86rem] text-ink-mute italic">
            copy YAML into policy.yaml
          </div>
        </div>
        <select
          className={clsx(inputCls, "min-w-[120px]")}
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

      {api.loading && (
        <div className="font-mono text-meta text-ink-mute">
          building suggestion…
        </div>
      )}
      {api.error && (
        <div className="my-2.5 font-mono text-meta text-block">{api.error}</div>
      )}
      {suggestion && (
        <>
          <div className="mb-2.5 flex flex-wrap gap-2 font-mono text-meta tracking-[0.1em] text-ink-mute uppercase">
            <span>{suggestion.tool}</span>
            {suggestion.duplicate && (
              <span className="text-allow">already covered</span>
            )}
          </div>
          {suggestion.warning && (
            <div className="my-2.5 font-mono text-meta text-brass-bright">
              {suggestion.warning}
            </div>
          )}
          <pre className={yamlBlockCls}>{suggestion.yaml}</pre>
          <CopyButton
            key={targetAction}
            className={btnCls}
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
  const [targetAction, setTargetAction] = useState<SuggestAction>(() =>
    initialSuggestAction(event),
  );

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
          <DrawerField label="timestamp">
            {new Date(event.timestamp).toLocaleString()}
          </DrawerField>
          <DrawerField label="action">{actionBadge(event.action)}</DrawerField>
          {event.would_action && (
            <DrawerField label="would be">
              {actionBadge(event.would_action)}
            </DrawerField>
          )}
          <DrawerField label="mode">{event.mode}</DrawerField>
          <DrawerField label="raw name">{event.raw_name || "—"}</DrawerField>
          <CopyField label="binary" value={event.binary} />
          <CopyField label="file" value={event.file} />
          <CopyField label="workdir" value={event.workdir} />
          <CopyField label="session" value={event.session} />
          <DrawerActions>
            {onApplyFilter &&
              filterButtons.map(
                (b) =>
                  event[b.key] && (
                    <Btn
                      key={b.key}
                      onClick={() => {
                        onApplyFilter(b.key, event[b.key]);
                        onClose();
                      }}
                    >
                      {b.label}
                    </Btn>
                  ),
              )}
          </DrawerActions>
          <RuleSuggestionPanel
            event={event}
            targetAction={targetAction}
            setTargetAction={setTargetAction}
          />
          <div
            className="mt-5 overflow-x-auto rounded border border-rule bg-bg p-3.5 font-mono text-meta leading-[1.6] wrap-break-word whitespace-pre-wrap text-ink-dim"
            dangerouslySetInnerHTML={{
              __html: highlightJson(event.tool_input),
            }}
          />
        </>
      )}
    </Drawer>
  );
}
