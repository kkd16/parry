import { useCallback, useEffect, useRef } from "react";
import { Bell, BookOpen, Bookmark, Gauge, Orbit, ScrollText, X } from "lucide-react";
import type { Tab } from "../App";
import type { PolicyOverviewState } from "../usePolicyOverview";
import { useLocalStorage } from "../hooks/useLocalStorage";
import type { BookmarksApi } from "../hooks/useBookmarks";
import type { DashboardCounts } from "../hooks/useDashboardCounts";

interface Props {
  tab: Tab;
  setTab: (t: Tab) => void;
  overview: PolicyOverviewState;
  eventCount: number;
  live: boolean;
  onShowHelp: () => void;
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
  overview,
  eventCount,
  live,
  onShowHelp,
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

  const { policy, health } = overview;
  const notify = policy?.notifications;
  const healthClass =
    health?.status === "ok" ? "ok" : health?.status === "error" ? "err" : "none";

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

  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="sidebar-brand-title">Parry</div>
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-nav-label">Instruments</div>
        <button
          className={`sidebar-nav-item${tab === "bridge" ? " active" : ""}`}
          onClick={() => setTab("bridge")}
        >
          <Gauge />
          <span>Bridge</span>
          {renderBadge(counts.today)}
          <span className="sidebar-nav-hint">g b</span>
        </button>
        <button
          className={`sidebar-nav-item${tab === "events" ? " active" : ""}`}
          onClick={() => setTab("events")}
        >
          <ScrollText />
          <span>Logbook</span>
          {renderBadge(eventCount > 0 ? eventCount : null)}
          <span className="sidebar-nav-hint">g e</span>
        </button>
        <button
          className={`sidebar-nav-item${tab === "solar" ? " active" : ""}`}
          onClick={() => setTab("solar")}
        >
          <Orbit />
          <span>Orrery</span>
          {renderBadge(counts.projects)}
          <span className="sidebar-nav-hint">g s</span>
        </button>
        <button
          className={`sidebar-nav-item${tab === "policy" ? " active" : ""}`}
          onClick={() => setTab("policy")}
        >
          <BookOpen />
          <span>Charter</span>
          {renderBadge(ruleCount)}
          <span className="sidebar-nav-hint">g p</span>
        </button>
        <button
          className={`sidebar-nav-item${tab === "notify" ? " active" : ""}`}
          onClick={() => setTab("notify")}
        >
          <Bell />
          <span>Beacon</span>
          <span className={`sidebar-nav-dot ${healthClass}`} />
          <span className="sidebar-nav-hint">g n</span>
        </button>

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
          <span className="sidebar-footer-label">mode</span>
          <span className="sidebar-footer-value">{policy?.mode ?? "—"}</span>
        </div>
        <div className="sidebar-footer-row">
          <span className="sidebar-footer-label">ver</span>
          <span className="sidebar-footer-value">{policy?.version ?? "—"}</span>
        </div>
        <div className="sidebar-footer-row">
          <span className="sidebar-footer-label">default</span>
          <span className="sidebar-footer-value">{policy?.default_action ?? "—"}</span>
        </div>
        <div className="sidebar-footer-row">
          <span className="sidebar-footer-label">notify</span>
          <span className="sidebar-footer-value" title={health?.error ?? ""}>
            <span className={`health-dot ${healthClass}`} />
            {notify?.provider ?? "none"}
          </span>
        </div>
        <div className="sidebar-footer-row">
          <span className="sidebar-footer-label">live</span>
          <span className="sidebar-footer-value">
            <span className={`health-dot ${live ? "ok" : "none"}`} />
            {live ? "on" : "off"}
          </span>
        </div>
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
