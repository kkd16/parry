import { useCallback, useEffect, useRef, type ReactNode } from "react";
import clsx from "clsx";
import { Bookmark, Workflow, X } from "lucide-react";
import { TABS, type Tab } from "../tabs";
import type { PolicyOverviewState } from "../hooks/usePolicyOverview";
import { useLocalStorage } from "../hooks/useLocalStorage";
import type { BookmarksApi } from "../hooks/useBookmarks";
import type { DashboardCounts } from "../types";
import { FieldLabel, HealthDot, Kbd } from "./ui";

interface Props {
  tab: Tab;
  setTab: (t: Tab) => void;
  policyOverview: PolicyOverviewState;
  eventCount: number;
  live: boolean;
  onShowHelp: () => void;
  onShowAbout: () => void;
  bookmarks: BookmarksApi;
  counts: DashboardCounts;
  onOpenBookmark: (qs: string) => void;
}

const MIN_W = 180;
const MAX_W = 360;

function formatCount(n: number | null): string {
  if (n == null) return "";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

const navBadgeCls =
  "rounded-lg border border-brass-dim bg-brass/10 px-1.5 py-px font-mono text-eyebrow tracking-[0.04em] text-brass";

function FooterRow({
  label,
  title,
  children,
}: {
  label: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-meta">
      <FieldLabel>{label}</FieldLabel>
      <span
        className="max-w-[110px] truncate font-mono text-meta text-ink-dim"
        title={title}
      >
        {children}
      </span>
    </div>
  );
}

export default function Sidebar({
  tab,
  setTab,
  policyOverview,
  eventCount,
  live,
  onShowHelp,
  onShowAbout,
  bookmarks,
  counts,
  onOpenBookmark,
}: Props) {
  const [width, setWidth] = useLocalStorage<number>("parry-sidebar-w", 232);
  const resizing = useRef(false);

  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-w", `${width}px`);
  }, [width]);

  const onDown = useCallback(() => {
    resizing.current = true;
    document.body.style.cursor = "col-resize";
  }, []);

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!resizing.current) return;
      const next = Math.min(MAX_W, Math.max(MIN_W, e.clientX));
      setWidth(next);
    };
    const up = () => {
      if (resizing.current) {
        resizing.current = false;
        document.body.style.cursor = "";
      }
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
  }, [setWidth]);

  const { policy, health } = policyOverview;
  const notify = policy?.notifications;

  const ruleCount = policy
    ? Object.values(policy.rules ?? {}).reduce((sum, rule) => {
        return (
          sum +
          (rule.allow?.length ?? 0) +
          (rule.confirm?.length ?? 0) +
          (rule.block?.length ?? 0)
        );
      }, 0)
    : null;

  const renderBadge = (n: number | null) =>
    n != null ? (
      <span className={clsx("ml-auto", navBadgeCls)}>{formatCount(n)}</span>
    ) : null;

  const renderDangerBadge = (n: number | null) =>
    n ? (
      <span
        className={clsx(
          "ml-auto",
          navBadgeCls,
          "border-block/35 bg-block/12 text-block",
        )}
        title="blocked or confirmed today"
      >
        {formatCount(n)}
      </span>
    ) : null;

  const tabBadge: Record<Tab, ReactNode> = {
    bridge: renderBadge(counts.today),
    logbook:
      renderDangerBadge(counts.blockedToday) ??
      renderBadge(eventCount > 0 ? eventCount : null),
    orrery: renderBadge(counts.projects),
    charter: renderBadge(ruleCount),
    beacon: <HealthDot status={health?.status} className="ml-auto" />,
    devdocs: null,
  };

  return (
    <aside className="relative flex flex-col border-r border-rule bg-[linear-gradient(180deg,#0c0d14_0%,#090a10_100%)] pt-7 pb-4 select-none">
      <div className="mb-5 border-b border-rule-soft px-7 pb-7">
        <button
          type="button"
          className="cursor-pointer text-left font-display text-[2.1rem] leading-none tracking-[-0.01em] text-ink italic transition-colors duration-150 hover:text-brass"
          onClick={onShowAbout}
          title="about parry"
        >
          Parry
        </button>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 px-3.5">
        <div className="px-3.5 pt-4.5 pb-2 font-mono text-eyebrow tracking-[0.2em] text-ink-mute uppercase">
          Instruments
        </div>
        {TABS.filter((t) => t.id !== "devdocs").map((t) => (
          <button
            key={t.id}
            className={clsx(
              "relative flex items-center gap-3 rounded px-3.5 py-2.5 text-left text-[0.88rem] font-medium text-ink-dim transition-colors duration-150 hover:bg-bg-hover hover:text-ink [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 [&_svg]:[stroke-width:1.8]",
              tab === t.id &&
                "bg-bg-hover text-ink before:absolute before:top-1/2 before:-left-3.5 before:h-[22px] before:w-0.5 before:-translate-y-1/2 before:bg-brass-bright before:shadow-[0_0_8px_var(--color-brass)] before:content-['']",
            )}
            onClick={() => setTab(t.id)}
          >
            <t.icon />
            <span>{t.label}</span>
            {tabBadge[t.id]}
            <span
              className={clsx(
                "font-mono text-[0.65rem] tracking-[0.05em] text-ink-mute",
                tabBadge[t.id] ? "ml-1.5" : "ml-auto",
              )}
            >
              g {t.key}
            </span>
          </button>
        ))}

        {bookmarks.bookmarks.length > 0 && (
          <>
            <div className="px-3.5 pt-4.5 pb-2 font-mono text-eyebrow tracking-[0.2em] text-ink-mute uppercase">
              Bookmarks
            </div>
            <div className="-mx-3.5 flex max-h-[200px] flex-col gap-px overflow-y-auto px-3.5">
              {bookmarks.bookmarks.map((b) => (
                <div key={b.id} className="flex items-center gap-1">
                  <button
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-[3px] px-2.5 py-1.5 text-left font-mono text-[0.7rem] text-ink-dim hover:bg-bg-hover hover:text-brass [&_svg]:h-3 [&_svg]:w-3 [&_svg]:shrink-0"
                    onClick={() => onOpenBookmark(b.qs)}
                    onDoubleClick={() => {
                      const next = window.prompt("rename bookmark", b.name);
                      if (next != null && next.trim())
                        bookmarks.rename(b.id, next.trim());
                    }}
                    title="click: open · dbl-click: rename"
                  >
                    <Bookmark />
                    <span className="flex-1 truncate">{b.name}</span>
                  </button>
                  <button
                    className="rounded-[3px] p-1 text-ink-mute hover:text-block"
                    onClick={() => bookmarks.remove(b.id)}
                    title="delete bookmark"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </nav>

      <div className="mt-3 flex flex-col gap-2.5 border-t border-rule-soft px-6 pt-4 pb-1">
        <FooterRow label="mode">{policy?.mode ?? "—"}</FooterRow>
        <FooterRow label="ver">{policy?.version ?? "—"}</FooterRow>
        <FooterRow label="default">{policy?.default_action ?? "—"}</FooterRow>
        <FooterRow label="notify" title={health?.error ?? ""}>
          <HealthDot status={health?.status} />
          {notify?.provider ?? "none"}
        </FooterRow>
        <FooterRow label="live">
          <HealthDot status={live ? "ok" : undefined} />
          {live ? "on" : "off"}
        </FooterRow>
        <button
          className={clsx(
            "mt-1 flex w-full items-center gap-2 rounded border border-rule bg-bg px-2.5 py-2 font-mono text-[0.64rem] tracking-[0.1em] text-ink-dim uppercase transition-colors duration-150 hover:border-brass-dim hover:text-brass [&_svg]:h-[13px] [&_svg]:w-[13px] [&_svg]:shrink-0",
            tab === "devdocs" && "border-brass-dim bg-observe/14 text-brass",
          )}
          onClick={() => setTab("devdocs")}
        >
          <Workflow />
          <span>Dev Docs</span>
          <Kbd className="ml-auto">g d</Kbd>
        </button>
        <button
          className="group mt-1.5 flex w-full flex-col items-start gap-1 rounded-[3px] border-t border-dashed border-rule-soft px-1 pt-2 pb-1 text-left font-mono text-[0.6rem] tracking-[0.08em] text-ink-mute uppercase hover:text-brass"
          onClick={onShowHelp}
        >
          <span className="inline-flex items-center gap-[5px]">
            <Kbd className="group-hover:border-brass-dim group-hover:text-brass">
              ⌘
            </Kbd>
            <Kbd className="group-hover:border-brass-dim group-hover:text-brass">
              space
            </Kbd>
            <span>palette</span>
          </span>
          <span className="inline-flex items-center gap-[5px]">
            <Kbd className="group-hover:border-brass-dim group-hover:text-brass">
              ?
            </Kbd>
            <span>help</span>
          </span>
        </button>
      </div>

      <div
        className="absolute top-0 -right-[3px] z-5 h-full w-1.5 cursor-col-resize after:absolute after:top-0 after:bottom-0 after:left-0.5 after:w-0.5 after:content-[''] hover:after:bg-brass"
        onMouseDown={onDown}
      />
    </aside>
  );
}
