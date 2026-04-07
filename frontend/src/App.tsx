import { useCallback, useMemo, useRef, useState } from "react";
import { BookOpen, Filter, Orbit, ScrollText, Search } from "lucide-react";
import EventsPage from "./EventsPage";
import SolarSystemPage from "./SolarSystemPage";
import PolicyPage from "./PolicyPage";
import Sidebar from "./components/Sidebar";
import CommandPalette from "./components/CommandPalette";
import { usePolicyOverview } from "./usePolicyOverview";
import { useKeyboardNav } from "./hooks/useKeyboardNav";
import { usePath } from "./hooks/useUrlState";
import {
  CommandsProvider,
  useRegisterCommands,
  type Command,
  type QuickFilter,
} from "./commands";

export type Tab = "events" | "solar" | "policy";

interface ShellState {
  setTab: (t: Tab) => void;
  setPendingFilter: (f: QuickFilter) => void;
}

function GlobalCommands({ setTab, setPendingFilter }: ShellState) {
  const cmds = useMemo<Command[]>(
    () => [
      {
        id: "nav.events",
        group: "Navigate",
        label: "Go to Logbook",
        hint: "g e",
        icon: <ScrollText />,
        keywords: ["events", "log"],
        perform: () => setTab("events"),
      },
      {
        id: "nav.solar",
        group: "Navigate",
        label: "Go to Orrery",
        hint: "g s",
        icon: <Orbit />,
        keywords: ["solar", "system", "files", "heatmap"],
        perform: () => setTab("solar"),
      },
      {
        id: "nav.policy",
        group: "Navigate",
        label: "Go to Charter",
        hint: "g p",
        icon: <BookOpen />,
        keywords: ["policy", "rules"],
        perform: () => setTab("policy"),
      },
      {
        id: "filter.blocked",
        group: "Filter events",
        label: "Show blocked events",
        icon: <Filter />,
        keywords: ["block", "denied"],
        perform: () => {
          setPendingFilter({ kind: "action", value: "block" });
          setTab("events");
        },
      },
      {
        id: "filter.confirm",
        group: "Filter events",
        label: "Show confirm events",
        icon: <Filter />,
        perform: () => {
          setPendingFilter({ kind: "action", value: "confirm" });
          setTab("events");
        },
      },
      {
        id: "filter.allow",
        group: "Filter events",
        label: "Show allowed events",
        icon: <Filter />,
        perform: () => {
          setPendingFilter({ kind: "action", value: "allow" });
          setTab("events");
        },
      },
      {
        id: "filter.observe",
        group: "Filter events",
        label: "Show observed events",
        icon: <Filter />,
        perform: () => {
          setPendingFilter({ kind: "action", value: "observe" });
          setTab("events");
        },
      },
      {
        id: "filter.shell",
        group: "Filter events",
        label: "Shell calls only",
        icon: <Filter />,
        perform: () => {
          setPendingFilter({ kind: "tool", value: "shell" });
          setTab("events");
        },
      },
      {
        id: "filter.file_edit",
        group: "Filter events",
        label: "File edits only",
        icon: <Filter />,
        perform: () => {
          setPendingFilter({ kind: "tool", value: "file_edit" });
          setTab("events");
        },
      },
      {
        id: "filter.file_read",
        group: "Filter events",
        label: "File reads only",
        icon: <Filter />,
        perform: () => {
          setPendingFilter({ kind: "tool", value: "file_read" });
          setTab("events");
        },
      },
      {
        id: "time.5m",
        group: "Time range",
        label: "Last 5 minutes",
        icon: <Search />,
        perform: () => {
          setPendingFilter({ kind: "time", value: "5m" });
          setTab("events");
        },
      },
      {
        id: "time.15m",
        group: "Time range",
        label: "Last 15 minutes",
        icon: <Search />,
        perform: () => {
          setPendingFilter({ kind: "time", value: "15m" });
          setTab("events");
        },
      },
      {
        id: "time.1h",
        group: "Time range",
        label: "Last hour",
        icon: <Search />,
        perform: () => {
          setPendingFilter({ kind: "time", value: "1h" });
          setTab("events");
        },
      },
      {
        id: "time.6h",
        group: "Time range",
        label: "Last 6 hours",
        icon: <Search />,
        perform: () => {
          setPendingFilter({ kind: "time", value: "6h" });
          setTab("events");
        },
      },
      {
        id: "time.24h",
        group: "Time range",
        label: "Last 24 hours",
        icon: <Search />,
        perform: () => {
          setPendingFilter({ kind: "time", value: "24h" });
          setTab("events");
        },
      },
      {
        id: "time.7d",
        group: "Time range",
        label: "Last 7 days",
        icon: <Search />,
        perform: () => {
          setPendingFilter({ kind: "time", value: "7d" });
          setTab("events");
        },
      },
      {
        id: "time.30d",
        group: "Time range",
        label: "Last 30 days",
        icon: <Search />,
        perform: () => {
          setPendingFilter({ kind: "time", value: "30d" });
          setTab("events");
        },
      },
    ],
    [setTab, setPendingFilter],
  );
  useRegisterCommands(cmds, [cmds]);
  return null;
}

function AppShell() {
  const [path, setPath] = usePath();
  const tab = path.slice(1) as Tab;
  const setTab = useCallback((t: Tab) => setPath("/" + t), [setPath]);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pendingFilter, setPendingFilter] = useState<QuickFilter | null>(null);
  const [eventCount, setEventCount] = useState(0);
  const [live, setLive] = useState(false);
  const overview = usePolicyOverview();
  const searchFocusRef = useRef<() => void>(() => {});

  const focusSearch = useCallback(() => searchFocusRef.current?.(), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);
  const queueFilter = useCallback((f: QuickFilter) => setPendingFilter(f), []);

  useKeyboardNav({
    onGoEvents: () => setTab("events"),
    onGoSolar: () => setTab("solar"),
    onGoPolicy: () => setTab("policy"),
    onOpenPalette: () => setPaletteOpen((v) => !v),
    onFocusSearch: focusSearch,
    onEscape: closePalette,
  });

  return (
    <>
      <GlobalCommands setTab={setTab} setPendingFilter={queueFilter} />
      <div className="shell">
        <Sidebar
          tab={tab}
          setTab={setTab}
          overview={overview}
          eventCount={eventCount}
          live={live}
        />
        <main className="shell-main">
          <div className="shell-main-inner">
            {tab === "events" && (
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
            {tab === "solar" && <SolarSystemPage />}
            {tab === "policy" && <PolicyPage {...overview} />}
          </div>
        </main>
        <CommandPalette open={paletteOpen} onClose={closePalette} />
      </div>
    </>
  );
}

export default function App() {
  return (
    <CommandsProvider>
      <AppShell />
    </CommandsProvider>
  );
}
