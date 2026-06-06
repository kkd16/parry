import { useEffect, useState } from "react";
import type { CommandExplanation, Explanation, RuleEntry } from "../types";
import { actionBadge } from "../policyBadges";

type DrillTool = "shell" | "file_read" | "file_edit";

const TOOLS: DrillTool[] = ["shell", "file_read", "file_edit"];

const PLACEHOLDER: Record<DrillTool, string> = {
  shell: "try a command… e.g. rm -rf /tmp/build",
  file_read: "try a path… e.g. ~/.ssh/id_rsa",
  file_edit: "try a path… e.g. /etc/passwd",
};

function entryLabel(e: RuleEntry): string {
  const parts = [e.binary, ...(e.positional ?? [])];
  if (e.flags?.length) parts.push(`[${e.flags.join(" ")}]`);
  return parts.join(" ");
}

function Stage({
  stage,
  index,
  total,
  onOpenBinary,
}: {
  stage: CommandExplanation;
  index: number;
  total: number;
  onOpenBinary: (b: string) => void;
}) {
  return (
    <div className="policy-drill-stage">
      {total > 1 && <span className="policy-drill-stage-n">stage {index + 1}</span>}
      <span className="policy-drill-stage-bin mono">{stage.binary}</span>
      {actionBadge(stage.action)}
      {stage.matched.is_default || !stage.matched.entry ? (
        <span className="policy-drill-chip is-default">shell default</span>
      ) : (
        <button
          className="policy-drill-chip"
          title="open this rule"
          onClick={() => onOpenBinary(stage.binary)}
        >
          rule · {entryLabel(stage.matched.entry)}
        </button>
      )}
    </div>
  );
}

export default function PolicyDrill({ onOpenBinary }: { onOpenBinary: (b: string) => void }) {
  const [tool, setTool] = useState<DrillTool>("shell");
  const [text, setText] = useState("");
  const [result, setResult] = useState<Explanation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onText = (v: string) => {
    setText(v);
    if (!v.trim()) {
      setResult(null);
      setError(null);
    }
  };

  useEffect(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      const input = tool === "shell" ? { command: trimmed } : { path: trimmed };
      fetch("/api/policy/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tool, tool_input: input }),
        signal: ctrl.signal,
      })
        .then(async (res) => {
          const data = (await res.json()) as Explanation & { error?: string };
          if (!res.ok) throw new Error(data.error ?? res.statusText);
          return data;
        })
        .then((data) => {
          setResult(data);
          setError(null);
        })
        .catch((e) => {
          if (e instanceof DOMException && e.name === "AbortError") return;
          setError(e instanceof Error ? e.message : String(e));
          setResult(null);
        });
    }, 280);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [text, tool]);

  return (
    <div className="policy-drill">
      <div className="policy-drill-controls">
        <div className="policy-drill-tools">
          {TOOLS.map((id) => (
            <button
              key={id}
              className={`policy-drill-tool${tool === id ? " active" : ""}`}
              onClick={() => setTool(id)}
            >
              {id}
            </button>
          ))}
        </div>
        <input
          className="input mono policy-drill-input"
          placeholder={PLACEHOLDER[tool]}
          value={text}
          onChange={(e) => onText(e.target.value)}
          spellCheck={false}
        />
      </div>

      {error && <div className="policy-drill-callout is-block">{error}</div>}

      {result && (
        <div className="policy-drill-result">
          <div className="policy-drill-verdict">
            <span className="policy-drill-verdict-label">verdict</span>
            {actionBadge(result.action)}
          </div>

          {result.unresolved && (
            <div className="policy-drill-callout is-block">
              unresolved syntax — parry cannot fully resolve this command, so it fails closed to
              block
            </div>
          )}

          {result.protected && (
            <div className="policy-drill-callout is-block">
              protected path <code>{result.protected.pattern}</code> matched{" "}
              <code>{result.protected.arg}</code> — blocked before any rule is consulted
            </div>
          )}

          {!!result.commands?.length && (
            <div className="policy-drill-stages">
              {result.commands.map((c, i) => (
                <Stage
                  key={`${i}-${c.binary}`}
                  stage={c}
                  index={i}
                  total={result.commands?.length ?? 0}
                  onOpenBinary={onOpenBinary}
                />
              ))}
            </div>
          )}

          {!result.unresolved && !result.protected && !result.commands?.length && (
            <div className="policy-drill-callout">
              no rule consulted — falls to the {result.tool} default
            </div>
          )}
        </div>
      )}
    </div>
  );
}
