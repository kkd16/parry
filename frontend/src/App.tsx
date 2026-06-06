import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Bell, Bookmark, Filter, Search } from "lucide-react";
import Sidebar from "./components/Sidebar";
import { focusSearchInput } from "./utils/dom";
import CommandPalette from "./components/CommandPalette";
import ShortcutsHelp from "./components/ShortcutsHelp";
import AboutDialog from "./components/AboutDialog";
import { MotionConfig } from "motion/react";
import { ToastsProvider } from "./components/Toasts";
import { usePolicyOverview } from "./hooks/usePolicyOverview";
import { useApi } from "./hooks/useApi";
import { getHeatmap, getOverview, postNotifyTest } from "./api";
import { useKeyboardNav } from "./hooks/useKeyboardNav";
import { openUrl, setUrlParams, usePath } from "./hooks/useUrlState";
import { TIME_OPTIONS } from "./hooks/useEventsFilters";
import { useBookmarks } from "./hooks/useBookmarks";
import { TABS, type Tab } from "./tabs";
import {
  CommandsProvider,
  useRegisterCommands,
  type Command,
} from "./commands";

const BridgePage = lazy(() => import("./BridgePage"));
const DevDocsPage = lazy(() => import("./DevDocsPage"));
const EventsPage = lazy(() => import("./EventsPage"));
const SolarSystemPage = lazy(() => import("./SolarSystemPage"));
const PolicyPage = lazy(() => import("./PolicyPage"));
const NotifyPage = lazy(() => import("./NotifyPage"));

const ACTION_FILTERS = [
  {
    value: "block",
    label: "Show blocked events",
    keywords: ["block", "denied"],
  },
  { value: "confirm", label: "Show confirm events", keywords: ["confirm"] },
  { value: "allow", label: "Show allowed events", keywords: ["allow"] },
  { value: "observe", label: "Show observed events", keywords: ["observe"] },
];

const TOOL_FILTERS = [
  { value: "shell", label: "Shell calls only" },
  { value: "file_edit", label: "File edits only" },
  { value: "file_read", label: "File reads only" },
];

function AppShell() {
  const [path, setPath] = usePath();
  const tab = path.slice(1) as Tab;
  const setTab = useCallback((t: Tab) => setPath("/" + t), [setPath]);
  const bookmarks = useBookmarks();
  const overviewApi = useApi(getOverview);
  const heatmapApi = useApi(getHeatmap);
  const openBookmark = useCallback((qs: string) => {
    openUrl("/logbook" + (qs ? "?" + qs : ""));
  }, []);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [eventCount, setEventCount] = useState(0);
  const [live, setLive] = useState(false);
  const policyOverview = usePolicyOverview();

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

  const closePalette = useCallback(() => setPaletteOpen(false), []);
  const closeShortcuts = useCallback(() => setShortcutsOpen(false), []);
  const openShortcuts = useCallback(() => setShortcutsOpen(true), []);
  const closeAbout = useCallback(() => setAboutOpen(false), []);
  const openAbout = useCallback(() => setAboutOpen(true), []);

  const filterTo = useCallback(
    (key: string, value: string) => {
      setUrlParams({ [key]: value, offset: "" });
      setTab("logbook");
    },
    [setTab],
  );

  const globalCmds = useMemo<Command[]>(
    () => [
      ...TABS.map((t) => ({
        id: `nav.${t.id}`,
        group: "Navigate",
        label: `Go to ${t.label}`,
        hint: `g ${t.key}`,
        icon: <t.icon />,
        keywords: t.keywords,
        perform: () => setTab(t.id),
      })),
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
      ...ACTION_FILTERS.map((f) => ({
        id: `filter.${f.value}`,
        group: "Filter events",
        label: f.label,
        icon: <Filter />,
        keywords: f.keywords,
        perform: () => filterTo("action", f.value),
      })),
      ...TOOL_FILTERS.map((f) => ({
        id: `filter.${f.value}`,
        group: "Filter events",
        label: f.label,
        icon: <Filter />,
        perform: () => filterTo("tool", f.value),
      })),
      ...TIME_OPTIONS.map((o) => ({
        id: `time.${o.value}`,
        group: "Time range",
        label: o.label,
        icon: <Search />,
        perform: () => filterTo("time", o.value),
      })),
    ],
    [setTab, filterTo, openShortcuts, openAbout],
  );
  useRegisterCommands(globalCmds, [globalCmds]);

  const bookmarkCmds = useMemo<Command[]>(
    () =>
      bookmarks.bookmarks.map((b) => ({
        id: `bookmark.${b.id}`,
        group: "Saved",
        label: b.name,
        icon: <Bookmark />,
        keywords: ["bookmark", "saved", b.qs],
        perform: () => openBookmark(b.qs),
      })),
    [bookmarks.bookmarks, openBookmark],
  );
  useRegisterCommands(bookmarkCmds, [bookmarkCmds]);

  useKeyboardNav({
    onGo: setTab,
    onOpenPalette: () => setPaletteOpen((v) => !v),
    onFocusSearch: focusSearchInput,
    onShowHelp: openShortcuts,
    onEscape: () => {
      closePalette();
      closeShortcuts();
      closeAbout();
    },
  });

  return (
    <>
      <div className="grid h-screen grid-cols-[var(--sidebar-w)_1fr] grid-rows-1 overflow-hidden">
        <Sidebar
          tab={tab}
          setTab={setTab}
          policyOverview={policyOverview}
          eventCount={eventCount}
          live={live}
          onShowHelp={openShortcuts}
          onShowAbout={openAbout}
          bookmarks={bookmarks}
          counts={{
            today: overviewApi.data?.today ?? null,
            blockedToday: overviewApi.data?.blocked_today ?? null,
            projects: heatmapApi.data?.projects.length ?? null,
          }}
          onOpenBookmark={openBookmark}
        />
        <main className="shell-main relative overflow-x-hidden overflow-y-auto">
          <div
            className={
              TABS.find((t) => t.id === tab)?.fullBleed
                ? "h-screen"
                : "mx-auto max-w-360 px-14 pt-14 pb-10"
            }
          >
            <Suspense fallback={null}>
              {tab === "bridge" && (
                <BridgePage
                  policyOverview={policyOverview}
                  overview={overviewApi.data}
                  error={overviewApi.error}
                  onEventClick={() => setTab("logbook")}
                  onFilterBinary={(b) => {
                    setUrlParams({ binary: b, offset: "" });
                    setTab("logbook");
                  }}
                />
              )}
              {tab === "logbook" && (
                <EventsPage
                  onCountChange={setEventCount}
                  onLiveChange={setLive}
                />
              )}
              {tab === "orrery" && (
                <SolarSystemPage
                  heatmap={heatmapApi.data}
                  error={heatmapApi.error}
                />
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
    <MotionConfig reducedMotion="user">
      <ToastsProvider>
        <CommandsProvider>
          <AppShell />
        </CommandsProvider>
      </ToastsProvider>
    </MotionConfig>
  );
}
