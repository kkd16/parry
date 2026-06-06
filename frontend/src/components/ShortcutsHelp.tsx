import Dialog from "./Dialog";
import { TABS } from "../tabs";
import "./ShortcutsHelp.css";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface ShortcutGroup {
  title: string;
  items: { keys: string[]; label: string }[];
}

const GROUPS: ShortcutGroup[] = [
  {
    title: "Navigation",
    items: TABS.map((t) => ({ keys: ["g", t.key], label: `Go to ${t.label}` })),
  },
  {
    title: "Search & Command",
    items: [
      { keys: ["⌘", "space"], label: "Open command palette" },
      { keys: ["/"], label: "Focus search" },
      { keys: ["?"], label: "Show this help" },
      { keys: ["esc"], label: "Close any overlay" },
    ],
  },
  {
    title: "Orrery",
    items: [
      { keys: ["drag"], label: "Pan view" },
      { keys: ["scroll"], label: "Zoom toward cursor" },
      { keys: ["dbl-click"], label: "Zoom in at point" },
      { keys: ["⇧", "dbl-click"], label: "Zoom out at point" },
    ],
  },
  {
    title: "Logbook",
    items: [
      { keys: ["click row"], label: "Open event drawer" },
      { keys: ["click ⇕ header"], label: "Sort column" },
      { keys: ["drag header edge"], label: "Resize column" },
    ],
  },
];

export default function ShortcutsHelp({ open, onClose }: Props) {
  return (
    <Dialog open={open} onClose={onClose} className="shortcuts-dialog">
      <div className="shortcuts-header">
        <div className="shortcuts-eyebrow">reference card</div>
        <h2 className="shortcuts-title">Keyboard shortcuts</h2>
      </div>
      <div className="shortcuts-body">
        {GROUPS.map((g) => (
          <div key={g.title} className="shortcuts-group">
            <div className="shortcuts-group-title">{g.title}</div>
            {g.items.map((item) => (
              <div key={item.label} className="shortcuts-row">
                <span className="shortcuts-row-label">{item.label}</span>
                <span className="shortcuts-row-keys">
                  {item.keys.map((k, i) => (
                    <span key={i}>
                      {i > 0 && <span className="shortcuts-sep">+</span>}
                      <span className="kbd">{k}</span>
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="shortcuts-footer">press esc or click outside to close</div>
    </Dialog>
  );
}
