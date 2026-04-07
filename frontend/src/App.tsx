import { useCallback, useRef, useState } from "react";
import EventsPage from "./EventsPage";
import SolarSystemPage from "./SolarSystemPage";
import PolicyPage from "./PolicyPage";
import Sidebar from "./components/Sidebar";
import StatusStrip from "./components/StatusStrip";
import CommandPalette from "./components/CommandPalette";
import type { QuickFilter } from "./components/CommandPalette";
import { usePolicyOverview } from "./usePolicyOverview";
import { useKeyboardNav } from "./hooks/useKeyboardNav";

export type Tab = "events" | "solar" | "policy";

export default function App() {
  const [tab, setTab] = useState<Tab>("events");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [pendingFilter, setPendingFilter] = useState<QuickFilter | null>(null);
  const [eventCount, setEventCount] = useState(0);
  const [live, setLive] = useState(false);
  const overview = usePolicyOverview();
  const searchFocusRef = useRef<() => void>(() => {});

  const focusSearch = useCallback(() => searchFocusRef.current?.(), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  useKeyboardNav({
    onGoEvents: () => setTab("events"),
    onGoSolar: () => setTab("solar"),
    onGoPolicy: () => setTab("policy"),
    onOpenPalette: () => setPaletteOpen((v) => !v),
    onFocusSearch: focusSearch,
    onEscape: closePalette,
  });

  return (
    <div className="shell">
      <Sidebar tab={tab} setTab={setTab} overview={overview} />
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
      <StatusStrip
        section={tab}
        eventCount={eventCount}
        live={live}
        mode={overview.policy?.mode}
      />
      <CommandPalette
        open={paletteOpen}
        onClose={closePalette}
        onNav={setTab}
        onQuickFilter={setPendingFilter}
      />
    </div>
  );
}
