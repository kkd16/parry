import { motion, AnimatePresence } from "motion/react";
import { useState } from "react";
import type { Event } from "../types";
import { actionBadge } from "../policyBadges";

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

export default function EventDrawer({ event, onClose, onApplyFilter }: Props) {
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
              {onApplyFilter && (
                <div className="drawer-actions">
                  {event.binary && (
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
                  {event.workdir && (
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
              )}
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
