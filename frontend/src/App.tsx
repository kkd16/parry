import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  BookOpen,
  Bookmark,
  Filter,
  Gauge,
  Orbit,
  ScrollText,
  Search,
  Workflow,
} from "lucide-react";
import Sidebar from "./components/Sidebar";
import CommandPalette from "./components/CommandPalette";
import ShortcutsHelp from "./components/ShortcutsHelp";
import AboutDialog from "./components/AboutDialog";
import { ToastsProvider } from "./components/Toasts";
import { usePolicyOverview } from "./hooks/usePolicyOverview";
import { useApi } from "./hooks/useApi";
import { getHeatmap, getOverview, postNotifyTest } from "./api";
import type { DashboardCounts } from "./types";
import { useKeyboardNav } from "./hooks/useKeyboardNav";
import { usePath, useUrlParam } from "./hooks/useUrlState";
import { useBookmarks, type BookmarksApi } from "./hooks/useBookmarks";
import {
  CommandsProvider,
  useRegisterCommands,
  type Command,
  type QuickFilter,
} from "./commands";
import "./Shell.css";

const BridgePage = lazy(() => import("./BridgePage"));
const DevDocsPage = lazy(() => import("./DevDocsPage"));
const EventsPage = lazy(() => import("./EventsPage"));
const SolarSystemPage = lazy(() => import("./SolarSystemPage"));
const PolicyPage = lazy(() => import("./PolicyPage"));
const NotifyPage = lazy(() => import("./NotifyPage"));

export type Tab = "bridge" | "logbook" | "orrery" | "charter" | "beacon" | "devdocs";

interface ShellState {
  setTab: (t: Tab) => void;
  setPendingFilter: (f: QuickFilter) => void;
  openShortcuts: () => void;
  openAbout: () => void;
}

function GlobalCommands({ setTab, setPendingFilter, openShortcuts, openAbout }: ShellState) {
  const cmds = useMemo<Command[]>(
    () => [
      {
        id: "nav.bridge",
        group: "Navigate",
        label: "Go to Bridge",
        hint: "g h",
        icon: <Gauge />,
        keywords: ["overview", "home", "dashboard"],
        perform: () => setTab("bridge"),
      },
      {
        id: "nav.logbook",
        group: "Navigate",
        label: "Go to Logbook",
        hint: "g l",
        icon: <ScrollText />,
        keywords: ["logbook", "log"],
        perform: () => setTab("logbook"),
      },
      {
        id: "nav.orrery",
        group: "Navigate",
        label: "Go to Orrery",
        hint: "g o",
        icon: <Orbit />,
        keywords: ["orrery", "system", "files", "heatmap"],
        perform: () => setTab("orrery"),
      },
      {
        id: "nav.charter",
        group: "Navigate",
        label: "Go to Charter",
        hint: "g c",
        icon: <BookOpen />,
        keywords: ["charter", "rules"],
        perform: () => setTab("charter"),
      },
      {
        id: "nav.beacon",
        group: "Navigate",
        label: "Go to Beacon",
        hint: "g b",
        icon: <Bell />,
        keywords: ["beacon", "notification", "alert", "ntfy", "provider", "beacon"],
        perform: () => setTab("beacon"),
      },
      {
        id: "nav.devdocs",
        group: "Navigate",
        label: "Go to Dev Docs",
        hint: "g d",
        icon: <Workflow />,
        keywords: ["docs", "architecture", "diagram", "dev", "flow"],
        perform: () => setTab("devdocs"),
      },
      {
        id: "notify.test",
        group: "Beacon",
        label: "Send a test notification",
        icon: <Bell />,
        keywords: ["test", "ping"],
        perform: () => {
          void postNotifyTest().catch(() => {});
          setTab("beacon");
        },
      },
      {
        id: "help.shortcuts",
        group: "Help",
        label: "Show keyboard shortcuts",
        hint: "?",
        perform: openShortcuts,
      },
      {
        id: "help.about",
        group: "Help",
        label: "About Parry",
        perform: openAbout,
      },
      {
        id: "filter.blocked",
        group: "Filter events",
        label: "Show blocked events",
        icon: <Filter />,
        keywords: ["block", "denied"],
        perform: () => {
          setPendingFilter({ kind: "action", value: "block" });
          setTab("logbook");
        },
      },
      {
        id: "filter.confirm",
        group: "Filter events",
        label: "Show confirm events",
        icon: <Filter />,
        perform: () => {
          setPendingFilter({ kind: "action", value: "confirm" });
          setTab("logbook");
        },
      },
      {
        id: "filter.allow",
        group: "Filter events",
        label: "Show allowed events",
        icon: <Filter />,
        perform: () => {
          setPendingFilter({ kind: "action", value: "allow" });
          setTab("logbook");
        },
      },
      {
        id: "filter.observe",
        group: "Filter events",
        label: "Show observed events",
        icon: <Filter />,
        perform: () => {
          setPendingFilter({ kind: "action", value: "observe" });
          setTab("logbook");
        },
      },
      {
        id: "filter.shell",
        group: "Filter events",
        label: "Shell calls only",
        icon: <Filter />,
        perform: () => {
          setPendingFilter({ kind: "tool", value: "shell" });
          setTab("logbook");
        },
      },
      {
        id: "filter.file_edit",
        group: "Filter events",
        label: "File edits only",
        icon: <Filter />,
        perform: () => {
          setPendingFilter({ kind: "tool", value: "file_edit" });
          setTab("logbook");
        },
      },
      {
        id: "filter.file_read",
        group: "Filter events",
        label: "File reads only",
        icon: <Filter />,
        perform: () => {
          setPendingFilter({ kind: "tool", value: "file_read" });
          setTab("logbook");
        },
      },
      {
        id: "time.5m",
        group: "Time range",
        label: "Last 5 minutes",
        icon: <Search />,
        perform: () => {
          setPendingFilter({ kind: "time", value: "5m" });
          setTab("logbook");
        },
      },
      {
        id: "time.15m",
        group: "Time range",
        label: "Last 15 minutes",
        icon: <Search />,
        perform: () => {
          setPendingFilter({ kind: "time", value: "15m" });
          setTab("logbook");
        },
      },
      {
        id: "time.1h",
        group: "Time range",
        label: "Last hour",
        icon: <Search />,
        perform: () => {
          setPendingFilter({ kind: "time", value: "1h" });
          setTab("logbook");
        },
      },
      {
        id: "time.6h",
        group: "Time range",
        label: "Last 6 hours",
        icon: <Search />,
        perform: () => {
          setPendingFilter({ kind: "time", value: "6h" });
          setTab("logbook");
        },
      },
      {
        id: "time.24h",
        group: "Time range",
        label: "Last 24 hours",
        icon: <Search />,
        perform: () => {
          setPendingFilter({ kind: "time", value: "24h" });
          setTab("logbook");
        },
      },
      {
        id: "time.7d",
        group: "Time range",
        label: "Last 7 days",
        icon: <Search />,
        perform: () => {
          setPendingFilter({ kind: "time", value: "7d" });
          setTab("logbook");
        },
      },
      {
        id: "time.30d",
        group: "Time range",
        label: "Last 30 days",
        icon: <Search />,
        perform: () => {
          setPendingFilter({ kind: "time", value: "30d" });
          setTab("logbook");
        },
      },
    ],
    [setTab, setPendingFilter, openShortcuts, openAbout],
  );
  useRegisterCommands(cmds, [cmds]);
  return null;
}

function BookmarkCommands({
  bookmarks,
  onOpen,
}: {
  bookmarks: BookmarksApi;
  onOpen: (qs: string) => void;
}) {
  const cmds = useMemo<Command[]>(
    () =>
      bookmarks.bookmarks.map((b) => ({
        id: `bookmark.${b.id}`,
        group: "Saved",
        label: b.name,
        icon: <Bookmark />,
        keywords: ["bookmark", "saved", b.qs],
        perform: () => onOpen(b.qs),
      })),
    [bookmarks.bookmarks, onOpen],
  );
  useRegisterCommands(cmds, [cmds]);
  return null;
}

function AppShell() {
  const [path, setPath] = usePath();
  const tab = path.slice(1) as Tab;
  const setTab = useCallback((t: Tab) => setPath("/" + t), [setPath]);
  const bookmarks = useBookmarks();
  const overviewApi = useApi(getOverview);
  const heatmapApi = useApi(getHeatmap);
  const counts = useMemo<DashboardCounts>(
    () => ({
      today: overviewApi.data?.today ?? null,
      blockedToday: overviewApi.data?.blocked_today ?? null,
      projects: heatmapApi.data?.projects.length ?? null,
    }),
    [overviewApi.data, heatmapApi.data],
  );
  const openBookmark = useCallback(
    (qs: string) => {
      window.history.pushState(null, "", "/logbook" + (qs ? "?" + qs : ""));
      window.dispatchEvent(new Event("parry:urlchange"));
    },
    [],
  );
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [pendingFilter, setPendingFilter] = useState<QuickFilter | null>(null);
  const [eventCount, setEventCount] = useState(0);
  const [live, setLive] = useState(false);
  const policyOverview = usePolicyOverview();
  const searchFocusRef = useRef<() => void>(() => {});
  const [, setBinaryParam] = useUrlParam("binary", "");

  const refetchOverview = overviewApi.refetch;
  const refetchHeatmap = heatmapApi.refetch;
  const firstTabRef = useRef(true);
  useEffect(() => {
    if (firstTabRef.current) {
      firstTabRef.current = false;
      return;
    }
    if (tab === "bridge") refetchOverview();
    else if (tab === "orrery") refetchHeatmap();
  }, [tab, refetchOverview, refetchHeatmap]);

  const focusSearch = useCallback(() => searchFocusRef.current?.(), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);
  const closeShortcuts = useCallback(() => setShortcutsOpen(false), []);
  const openShortcuts = useCallback(() => setShortcutsOpen(true), []);
  const closeAbout = useCallback(() => setAboutOpen(false), []);
  const openAbout = useCallback(() => setAboutOpen(true), []);
  const queueFilter = useCallback((f: QuickFilter) => setPendingFilter(f), []);

  useKeyboardNav({
    onGoHelm: () => setTab("bridge"),
    onGoLogbook: () => setTab("logbook"),
    onGoOrrery: () => setTab("orrery"),
    onGoCharter: () => setTab("charter"),
    onGoBeacon: () => setTab("beacon"),
    onGoDevDocs: () => setTab("devdocs"),
    onOpenPalette: () => setPaletteOpen((v) => !v),
    onFocusSearch: focusSearch,
    onShowHelp: openShortcuts,
    onEscape: () => {
      closePalette();
      closeShortcuts();
      closeAbout();
    },
  });

  return (
    <>
      <GlobalCommands
        setTab={setTab}
        setPendingFilter={queueFilter}
        openShortcuts={openShortcuts}
        openAbout={openAbout}
      />
      <BookmarkCommands bookmarks={bookmarks} onOpen={openBookmark} />
      <div className="shell">
        <Sidebar
          tab={tab}
          setTab={setTab}
          policyOverview={policyOverview}
          eventCount={eventCount}
          live={live}
          onShowHelp={openShortcuts}
          onShowAbout={openAbout}
          bookmarks={bookmarks}
          counts={counts}
          onOpenBookmark={openBookmark}
        />
        <main className="shell-main">
          <div className="shell-main-inner">
            <Suspense fallback={null}>
              {tab === "bridge" && (
                <BridgePage
                  policyOverview={policyOverview}
                  overview={overviewApi.data}
                  error={overviewApi.error}
                  onEventClick={() => setTab("logbook")}
                  onFilterBinary={(b) => {
                    setBinaryParam(b);
                    setTab("logbook");
                  }}
                />
              )}
              {tab === "logbook" && (
                <EventsPage
                  onCountChange={setEventCount}
                  onLiveChange={setLive}
                  pendingFilter={pendingFilter}
                  consumePendingFilter={() => setPendingFilter(null)}
                  registerSearchFocus={(fn) => {
                    searchFocusRef.current = fn;
                  }}
                />
              )}
              {tab === "orrery" && (
                <SolarSystemPage heatmap={heatmapApi.data} error={heatmapApi.error} />
              )}
              {tab === "charter" && <PolicyPage {...policyOverview} />}
              {tab === "beacon" && (
                <NotifyPage
                  policyOverview={policyOverview}
                  onGoToEvents={() => setTab("logbook")}
                />
              )}
              {tab === "devdocs" && <DevDocsPage />}
            </Suspense>
          </div>
        </main>
        <CommandPalette open={paletteOpen} onClose={closePalette} />
        <ShortcutsHelp open={shortcutsOpen} onClose={closeShortcuts} />
        <AboutDialog open={aboutOpen} onClose={closeAbout} />
      </div>
    </>
  );
}

export default function App() {
  return (
    <ToastsProvider>
      <CommandsProvider>
        <AppShell />
      </CommandsProvider>
    </ToastsProvider>
  );
}
