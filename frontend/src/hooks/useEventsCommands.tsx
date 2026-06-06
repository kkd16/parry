import { useMemo } from "react";
import {
  Columns3,
  Download,
  Eraser,
  FileJson,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { useRegisterCommands, type Command } from "../commands";

interface Opts {
  autoRefresh: boolean;
  onToggleLive: () => void;
  onRefresh: () => void;
  onExportCsv: () => void;
  onExportJson: () => void;
  onToggleColumns: () => void;
  onFocusSearch: () => void;
  onClearFilters: () => void;
  setDensity: (d: "compact" | "normal" | "comfortable") => void;
}

export function useEventsCommands({
  autoRefresh,
  onToggleLive,
  onRefresh,
  onExportCsv,
  onExportJson,
  onToggleColumns,
  onFocusSearch,
  onClearFilters,
  setDensity,
}: Opts) {
  const cmds = useMemo<Command[]>(
    () => [
      {
        id: "events.refresh",
        group: "Logbook",
        label: "Refresh logbook",
        icon: <RotateCcw />,
        keywords: ["reload", "refetch"],
        perform: onRefresh,
      },
      {
        id: "events.toggle-live",
        group: "Logbook",
        label: autoRefresh ? "Stop live tail" : "Start live tail",
        icon: <RefreshCw />,
        keywords: ["auto", "tail", "follow"],
        perform: onToggleLive,
      },
      {
        id: "events.csv",
        group: "Logbook",
        label: "Export current view as CSV",
        icon: <Download />,
        keywords: ["download", "export"],
        perform: onExportCsv,
      },
      {
        id: "events.json",
        group: "Logbook",
        label: "Export current view as JSON",
        icon: <FileJson />,
        keywords: ["download", "export"],
        perform: onExportJson,
      },
      {
        id: "events.columns",
        group: "Logbook",
        label: "Toggle column picker",
        icon: <Columns3 />,
        perform: onToggleColumns,
      },
      {
        id: "events.focus-search",
        group: "Logbook",
        label: "Focus search",
        hint: "/",
        perform: onFocusSearch,
      },
      {
        id: "events.clear-filters",
        group: "Logbook",
        label: "Clear all filters",
        icon: <Eraser />,
        perform: onClearFilters,
      },
      ...(["compact", "normal", "comfortable"] as const).map((d) => ({
        id: `events.density.${d}`,
        group: "Logbook",
        label: `Density: ${d}`,
        perform: () => setDensity(d),
      })),
    ],
    [
      autoRefresh,
      onToggleLive,
      onRefresh,
      onExportCsv,
      onExportJson,
      onToggleColumns,
      onFocusSearch,
      onClearFilters,
      setDensity,
    ],
  );
  useRegisterCommands(cmds, [cmds]);
}
