import { useCallback, useMemo } from "react";
import clsx from "clsx";
import type { Rule } from "../types";
import { getEvents } from "../api";
import { useApi } from "../hooks/useApi";
import { actionBadge } from "../policyBadges";
import CopyButton from "./CopyButton";
import Drawer, {
  DrawerActions,
  drawerLabelCls,
  drawerSectionCls,
  yamlBlockCls,
} from "./Drawer";
import { Btn, btnCls } from "./ui";
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

const codeCls =
  "[&_code]:rounded-[3px] [&_code]:bg-brass/8 [&_code]:px-[5px] [&_code]:py-px [&_code]:font-mono [&_code]:text-[0.78em] [&_code]:text-brass-bright [&_code]:not-italic";

const verdictCls = clsx(
  "mt-0.5 mb-1.5 font-display text-[1.05rem] leading-[1.9] text-ink italic",
  codeCls,
);

const ladderRowCls =
  "relative grid grid-cols-[1fr_auto] items-center gap-y-0.5 border-l-2 border-rule py-[9px] pl-4 before:absolute before:top-4 before:-left-1 before:h-1.5 before:w-1.5 before:rotate-45 before:border before:border-ink-mute before:bg-bg-raised before:content-['']";

function Verdict({ x }: { x: BinaryExplanation }) {
  const rows = x.rows;
  if (rows.length === 1) {
    const r = rows[0];
    if (r.specificity === 0) {
      return (
        <p className={verdictCls}>
          Every <code>{x.binary}</code> command {PHRASE[r.action]}.
        </p>
      );
    }
    return (
      <p className={verdictCls}>
        <code>{r.label}</code> {PHRASE[r.action]}; any other{" "}
        <code>{x.binary}</code> command falls to the shell default,{" "}
        {actionBadge(x.shellDefault)}.
      </p>
    );
  }
  const top = rows[0];
  const bare = rows.find((r) => r.specificity === 0);
  if (bare && bare !== top && rows.length === 2) {
    const word =
      STRICTNESS[top.action] > STRICTNESS[bare.action]
        ? "escalates"
        : "relaxes";
    return (
      <p className={verdictCls}>
        <code>{x.binary}</code> {PHRASE[bare.action]} by default, but{" "}
        <code>{top.label}</code> {word} to {actionBadge(top.action)} because the
        more specific rule wins.
      </p>
    );
  }
  return (
    <p className={verdictCls}>
      {rows.length} rules govern <code>{x.binary}</code>; the most specific
      match decides
      {x.actions.length > 1 ? ", strictest on ties" : ""}. Anything unmatched
      falls to the shell default, {actionBadge(x.shellDefault)}.
    </p>
  );
}

function RecentActivity({
  binary,
  onViewLogbook,
}: {
  binary: string;
  onViewLogbook: (binary: string) => void;
}) {
  const nowTick = useNowTick(30_000);
  const recentApi = useApi(
    useCallback(
      (signal: AbortSignal) =>
        getEvents(new URLSearchParams({ binary, limit: "5" }), signal),
      [binary],
    ),
  );
  const events = recentApi.error ? [] : (recentApi.data?.events ?? null);

  return (
    <section className={drawerSectionCls}>
      <div className={drawerLabelCls}>recent activity</div>
      {events === null && (
        <div className="mt-2 text-[0.76rem] text-ink-mute italic">loading…</div>
      )}
      {events?.length === 0 && (
        <div className="mt-2 text-[0.76rem] text-ink-mute italic">
          no logged calls to {binary} yet
        </div>
      )}
      {!!events?.length && (
        <ul className="mt-2.5">
          {events.map((e) => {
            const cmd =
              typeof e.tool_input.command === "string"
                ? e.tool_input.command
                : e.file;
            return (
              <li
                key={e.id}
                className="flex items-center gap-2.5 border-b border-dashed border-rule-soft py-[7px]"
              >
                <span className="min-w-[72px] shrink-0 font-mono text-tiny text-ink-mute">
                  {formatRelative(e.timestamp, nowTick)}
                </span>
                {actionBadge(e.action)}
                <span
                  className="flex-1 truncate font-mono text-[0.74rem] text-ink-dim"
                  title={cmd}
                >
                  {cmd}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      <DrawerActions>
        <Btn onClick={() => onViewLogbook(binary)}>view all in logbook</Btn>
      </DrawerActions>
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

export default function RuleDrawer({
  binary,
  rule,
  globalDefault,
  onClose,
  onViewLogbook,
}: Props) {
  const x = useMemo(
    () => (binary && rule ? explainBinary(binary, rule, globalDefault) : null),
    [binary, rule, globalDefault],
  );

  return (
    <Drawer
      open={!!(binary && x)}
      onClose={onClose}
      eyebrow="shell rule"
      title={binary}
    >
      {binary && x && (
        <>
          <Verdict x={x} />

          <section className={drawerSectionCls}>
            <div className={drawerLabelCls}>precedence</div>
            <div className="mt-3 flex flex-col">
              {x.rows.map((r) => (
                <div className={ladderRowCls} key={r.label + r.action}>
                  <span className="font-mono text-[0.78rem] text-ink">
                    {r.label}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    {actionBadge(r.action)}
                    <span
                      className="cursor-help rounded-sm border border-rule px-1.5 py-px font-mono text-micro text-ink-mute"
                      title="specificity: positional + flags"
                    >
                      {r.specificity}
                    </span>
                  </span>
                  <span className="col-span-full font-display text-[0.78rem] text-ink-mute italic">
                    {r.reason}
                  </span>
                </div>
              ))}
              <div className={clsx(ladderRowCls, "border-dashed")}>
                <span className="font-mono text-[0.78rem] text-ink-dim italic">
                  anything else
                </span>
                <span className="inline-flex items-center gap-2">
                  {actionBadge(x.shellDefault)}
                </span>
                <span className="col-span-full font-display text-[0.78rem] text-ink-mute italic">
                  shell default
                </span>
              </div>
            </div>
          </section>

          <section className={drawerSectionCls}>
            <div className={drawerLabelCls}>how matching works</div>
            <ul
              className={clsx(
                "mt-2.5 text-[0.78rem] leading-[1.8] text-ink-dim",
                codeCls,
              )}
            >
              <li className="before:text-brass before:content-['·_']">
                the command's binary must be exactly <code>{binary}</code> —
                path prefixes like <code>/bin/{binary}</code> resolve to the
                same rule
              </li>
              {x.rows.some(
                (r) => r.label.split(" ").length > 1 && !r.label.includes("["),
              ) && (
                <li className="before:text-brass before:content-['·_']">
                  positional words match as an ordered prefix: extra arguments
                  after them do not change the verdict
                </li>
              )}
              {x.flagForms.length > 0 && (
                <li className="before:text-brass before:content-['·_']">
                  flags in rules are semantic names — every spelling listed
                  below triggers the rule, in any order or bundling
                </li>
              )}
            </ul>
          </section>

          {x.flagForms.length > 0 && (
            <section className={drawerSectionCls}>
              <div className={drawerLabelCls}>flag equivalents</div>
              <div className="mt-2.5">
                {x.flagForms.map((f) => (
                  <div
                    className="grid grid-cols-[140px_1fr] gap-3 border-b border-dashed border-rule-soft py-[7px]"
                    key={f.name}
                  >
                    <span className="font-mono text-[0.68rem] tracking-[0.12em] text-ink-mute uppercase">
                      {f.name}
                    </span>
                    <span className="font-mono text-[0.74rem] tracking-[0.04em] text-ink">
                      {f.forms.join("  ")}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section className={drawerSectionCls}>
            <div className={drawerLabelCls}>
              examples — illustrative, not exhaustive
            </div>
            <ul className="mt-2.5">
              {x.examples.map((ex) => (
                <li
                  key={ex.command}
                  className="grid grid-cols-[1fr_auto] items-center gap-3 border-b border-dashed border-rule-soft py-2"
                >
                  <span className="font-mono text-[0.76rem] break-all text-ink">
                    {ex.command}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    {actionBadge(ex.action)}
                    <span className="max-w-[180px] truncate font-mono text-micro text-ink-mute">
                      {ex.via}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className={drawerSectionCls}>
            <div className={drawerLabelCls}>as written in policy.yaml</div>
            <pre className={yamlBlockCls}>{x.yaml}</pre>
            <DrawerActions>
              <CopyButton className={btnCls} text={x.yaml} label="copy yaml" />
            </DrawerActions>
          </section>

          <RecentActivity
            key={binary}
            binary={binary}
            onViewLogbook={onViewLogbook}
          />

          <div className="h-4.5" />
        </>
      )}
    </Drawer>
  );
}
