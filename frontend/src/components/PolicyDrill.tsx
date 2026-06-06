import { useMemo, useState } from "react";
import clsx from "clsx";
import type { CommandExplanation, RuleEntry } from "../types";
import { postPolicyEvaluate } from "../api";
import { useApi } from "../hooks/useApi";
import { actionBadge } from "../policyBadges";
import { inputCls } from "./ui";

type DrillTool = "shell" | "file_read" | "file_edit";

const TOOLS: DrillTool[] = ["shell", "file_read", "file_edit"];

const PLACEHOLDER: Record<DrillTool, string> = {
  shell: "try a command… e.g. rm -rf /tmp/build",
  file_read: "try a path… e.g. ~/.ssh/id_rsa",
  file_edit: "try a path… e.g. /etc/passwd",
};

const calloutBlockCls =
  "rounded-r border-l-2 border-block bg-block/12 px-3 py-2 text-[0.82rem] leading-[1.5] text-ink [&_code]:font-mono [&_code]:text-body [&_code]:text-brass-bright";

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
    <div className="flex items-center gap-2.5 py-1">
      {total > 1 && (
        <span className="min-w-[52px] font-mono text-[0.64rem] tracking-[0.12em] text-ink-mute uppercase">
          stage {index + 1}
        </span>
      )}
      <span className="min-w-[80px] font-mono text-[0.82rem] text-ink">
        {stage.binary}
      </span>
      {actionBadge(stage.action)}
      {stage.matched.is_default || !stage.matched.entry ? (
        <span className="rounded-full border border-dashed border-rule bg-bg px-2.5 py-[3px] font-mono text-[0.68rem] text-ink-mute">
          shell default
        </span>
      ) : (
        <button
          className="cursor-pointer rounded-full border border-rule bg-bg px-2.5 py-[3px] font-mono text-[0.68rem] text-ink-dim transition-all duration-150 hover:border-brass-dim hover:text-brass"
          title="open this rule"
          onClick={() => onOpenBinary(stage.binary)}
        >
          rule · {entryLabel(stage.matched.entry)}
        </button>
      )}
    </div>
  );
}

export default function PolicyDrill({
  onOpenBinary,
}: {
  onOpenBinary: (b: string) => void;
}) {
  const [tool, setTool] = useState<DrillTool>("shell");
  const [text, setText] = useState("");
  const trimmed = text.trim();

  const api = useApi(
    useMemo(() => {
      if (!trimmed) return null;
      const input = tool === "shell" ? { command: trimmed } : { path: trimmed };
      return (signal: AbortSignal) =>
        postPolicyEvaluate({ tool, tool_input: input }, signal);
    }, [trimmed, tool]),
    280,
  );
  const error = trimmed ? api.error : null;
  const result = trimmed && !api.loading && !api.error ? api.data : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="inline-flex overflow-hidden rounded border border-rule">
          {TOOLS.map((id) => (
            <button
              key={id}
              className={clsx(
                "cursor-pointer bg-bg px-3 py-[7px] font-mono text-[0.7rem] tracking-[0.06em] text-ink-dim transition-all duration-150 not-first:border-l not-first:border-rule hover:text-ink",
                tool === id && "bg-bg-active text-brass",
              )}
              onClick={() => setTool(id)}
            >
              {id}
            </button>
          ))}
        </div>
        <input
          className={clsx("min-w-[260px] flex-1", inputCls)}
          placeholder={PLACEHOLDER[tool]}
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
        />
      </div>

      {error && <div className={calloutBlockCls}>{error}</div>}

      {result && (
        <div className="flex flex-col gap-2.5 rounded-md border border-rule-soft bg-bg-raised px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="font-mono text-tiny font-semibold tracking-[0.18em] text-ink-mute uppercase">
              verdict
            </span>
            {actionBadge(result.action)}
          </div>

          {result.unresolved && (
            <div className={calloutBlockCls}>
              unresolved syntax — parry cannot fully resolve this command, so it
              fails closed to block
            </div>
          )}

          {result.protected && (
            <div className={calloutBlockCls}>
              protected path <code>{result.protected.pattern}</code> matched{" "}
              <code>{result.protected.arg}</code> — blocked before any rule is
              consulted
            </div>
          )}

          {!!result.commands?.length && (
            <div className="flex flex-col gap-1.5">
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

          {!result.unresolved &&
            !result.protected &&
            !result.commands?.length && (
              <div className="border-l-2 border-rule py-1 pl-3 text-[0.82rem] leading-[1.5] text-ink-dim">
                no rule consulted — falls to the {result.tool} default
              </div>
            )}
        </div>
      )}
    </div>
  );
}
