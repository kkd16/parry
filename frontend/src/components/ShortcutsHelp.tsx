import { motion, AnimatePresence } from "motion/react";

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
    items: [
      { keys: ["g", "b"], label: "Go to Bridge" },
      { keys: ["g", "e"], label: "Go to Logbook" },
      { keys: ["g", "s"], label: "Go to Orrery" },
      { keys: ["g", "p"], label: "Go to Charter" },
      { keys: ["g", "n"], label: "Go to Beacon" },
    ],
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
    <AnimatePresence>
      {open && (
        <motion.div
          className="cmdk-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
        >
          <motion.div
            className="shortcuts-dialog"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", damping: 28, stiffness: 360 }}
            onClick={(e) => e.stopPropagation()}
          >
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
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
