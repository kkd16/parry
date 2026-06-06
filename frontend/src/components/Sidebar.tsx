import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { Bookmark, Workflow, X } from "lucide-react";
import { TABS, type Tab } from "../tabs";
import type { PolicyOverviewState } from "../hooks/usePolicyOverview";
import { useLocalStorage } from "../hooks/useLocalStorage";
import type { BookmarksApi } from "../hooks/useBookmarks";
import type { DashboardCounts } from "../types";
import { healthClass } from "../policyBadges";
import "./Sidebar.css";

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
  const healthCls = healthClass(health?.status);

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
    n != null ? <span className="sidebar-nav-badge">{formatCount(n)}</span> : null;

  const renderDangerBadge = (n: number | null) =>
    n ? (
      <span className="sidebar-nav-badge danger" title="blocked or confirmed today">
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
    beacon: <span className={`sidebar-nav-dot ${healthCls}`} />,
    devdocs: null,
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <button
          type="button"
          className="sidebar-brand-title sidebar-brand-button"
          onClick={onShowAbout}
          title="about parry"
        >
          Parry
        </button>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-nav-label">Instruments</div>
        {TABS.filter((t) => t.id !== "devdocs").map((t) => (
          <button
            key={t.id}
            className={`sidebar-nav-item${tab === t.id ? " active" : ""}`}
            onClick={() => setTab(t.id)}
          >
            <t.icon />
            <span>{t.label}</span>
            {tabBadge[t.id]}
            <span className="sidebar-nav-hint">g {t.key}</span>
          </button>
        ))}

        {bookmarks.bookmarks.length > 0 && (
          <>
            <div className="sidebar-nav-label">Bookmarks</div>
            <div className="sidebar-bookmarks">
              {bookmarks.bookmarks.map((b) => (
                <div key={b.id} className="sidebar-bookmark">
                  <button
                    className="sidebar-bookmark-link"
                    onClick={() => onOpenBookmark(b.qs)}
                    onDoubleClick={() => {
                      const next = window.prompt("rename bookmark", b.name);
                      if (next != null && next.trim()) bookmarks.rename(b.id, next.trim());
                    }}
                    title="click: open · dbl-click: rename"
                  >
                    <Bookmark />
                    <span className="sidebar-bookmark-name">{b.name}</span>
                  </button>
                  <button
                    className="sidebar-bookmark-x"
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

      <div className="sidebar-footer">
        <div className="sidebar-footer-row">
          <span className="field-label">mode</span>
          <span className="sidebar-footer-value">{policy?.mode ?? "—"}</span>
        </div>
        <div className="sidebar-footer-row">
          <span className="field-label">ver</span>
          <span className="sidebar-footer-value">{policy?.version ?? "—"}</span>
        </div>
        <div className="sidebar-footer-row">
          <span className="field-label">default</span>
          <span className="sidebar-footer-value">{policy?.default_action ?? "—"}</span>
        </div>
        <div className="sidebar-footer-row">
          <span className="field-label">notify</span>
          <span className="sidebar-footer-value" title={health?.error ?? ""}>
            <span className={`health-dot ${healthCls}`} />
            {notify?.provider ?? "none"}
          </span>
        </div>
        <div className="sidebar-footer-row">
          <span className="field-label">live</span>
          <span className="sidebar-footer-value">
            <span className={`health-dot ${live ? "ok" : "none"}`} />
            {live ? "on" : "off"}
          </span>
        </div>
        <button
          className={`sidebar-footer-docs-btn${tab === "devdocs" ? " active" : ""}`}
          onClick={() => setTab("devdocs")}
        >
          <Workflow />
          <span>Dev Docs</span>
          <span className="kbd">g d</span>
        </button>
        <button className="sidebar-footer-hint-btn" onClick={onShowHelp}>
          <span className="sidebar-footer-hint-row">
            <span className="kbd">⌘</span>
            <span className="kbd">space</span>
            <span>palette</span>
          </span>
          <span className="sidebar-footer-hint-row">
            <span className="kbd">?</span>
            <span>help</span>
          </span>
        </button>
      </div>

      <div className="sidebar-resize" onMouseDown={onDown} />
    </aside>
  );
}
