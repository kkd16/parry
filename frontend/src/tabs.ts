import {
  Bell,
  BookOpen,
  Gauge,
  Orbit,
  ScrollText,
  Workflow,
} from "lucide-react";
import type { ElementType } from "react";

export type Tab =
  | "bridge"
  | "logbook"
  | "orrery"
  | "charter"
  | "beacon"
  | "devdocs";

export interface TabSpec {
  id: Tab;
  label: string;
  icon: ElementType;
  key: string;
  keywords: string[];
  fullBleed?: boolean;
}

export const TABS: TabSpec[] = [
  {
    id: "bridge",
    label: "Bridge",
    icon: Gauge,
    key: "h",
    keywords: ["overview", "home", "dashboard"],
  },
  {
    id: "logbook",
    label: "Logbook",
    icon: ScrollText,
    key: "l",
    keywords: ["logbook", "log", "events"],
  },
  {
    id: "orrery",
    label: "Orrery",
    icon: Orbit,
    key: "o",
    keywords: ["orrery", "system", "files", "heatmap"],
    fullBleed: true,
  },
  {
    id: "charter",
    label: "Charter",
    icon: BookOpen,
    key: "c",
    keywords: ["charter", "rules", "policy"],
  },
  {
    id: "beacon",
    label: "Beacon",
    icon: Bell,
    key: "b",
    keywords: ["beacon", "notification", "alert", "ntfy", "provider"],
  },
  {
    id: "devdocs",
    label: "Dev Docs",
    icon: Workflow,
    key: "d",
    keywords: ["docs", "architecture", "diagram", "dev", "flow"],
  },
];
