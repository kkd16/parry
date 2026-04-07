import { useCallback, useEffect, useRef } from "react";
import { BookOpen, Gauge, Orbit, ScrollText } from "lucide-react";
import type { Tab } from "../App";
import type { PolicyOverviewState } from "../usePolicyOverview";
import { useLocalStorage } from "../hooks/useLocalStorage";

interface Props {
  tab: Tab;
  setTab: (t: Tab) => void;
  overview: PolicyOverviewState;
  eventCount: number;
  live: boolean;
  onShowHelp: () => void;
}

const MIN_W = 180;
const MAX_W = 360;

export default function Sidebar({ tab, setTab, overview, eventCount, live, onShowHelp }: Props) {
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
          <span className="sidebar-nav-hint">g b</span>
        </button>
        <button
          className={`sidebar-nav-item${tab === "events" ? " active" : ""}`}
          onClick={() => setTab("events")}
        >
          <ScrollText />
          <span>Logbook</span>
          <span className="sidebar-nav-hint">g e</span>
        </button>
        <button
          className={`sidebar-nav-item${tab === "solar" ? " active" : ""}`}
          onClick={() => setTab("solar")}
        >
          <Orbit />
          <span>Orrery</span>
          <span className="sidebar-nav-hint">g s</span>
        </button>
        <button
          className={`sidebar-nav-item${tab === "policy" ? " active" : ""}`}
          onClick={() => setTab("policy")}
        >
          <BookOpen />
          <span>Charter</span>
          <span className="sidebar-nav-hint">g p</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-footer-row">
          <span className="sidebar-footer-label">mode</span>
          <span className="sidebar-footer-value">
            {policy?.mode ?? "—"}
          </span>
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
          <span className="sidebar-footer-label">events</span>
          <span className="sidebar-footer-value">{eventCount.toLocaleString()}</span>
        </div>
        <div className="sidebar-footer-row">
          <span className="sidebar-footer-label">live</span>
          <span className="sidebar-footer-value">
            <span className={`health-dot ${live ? "ok" : "none"}`} />
            {live ? "on" : "off"}
          </span>
        </div>
        <button className="sidebar-footer-hint-btn" onClick={onShowHelp}>
          <span className="kbd">⌘</span>
          <span className="kbd">space</span>
          <span>palette</span>
          <span className="sidebar-footer-sep">·</span>
          <span className="kbd">?</span>
          <span>help</span>
        </button>
      </div>

      <div className="sidebar-resize" onMouseDown={onDown} />
    </aside>
  );
}
