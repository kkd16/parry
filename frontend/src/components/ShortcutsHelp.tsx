import clsx from "clsx";
import Dialog, {
  dialogHeaderCls,
  dialogPanelCls,
  dialogTitleCls,
} from "./Dialog";
import { Eyebrow, Kbd } from "./ui";
import { TABS } from "../tabs";

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
    <Dialog
      open={open}
      onClose={onClose}
      className={clsx("w-[min(640px,92vw)]", dialogPanelCls)}
    >
      <div className={dialogHeaderCls}>
        <Eyebrow>reference card</Eyebrow>
        <h2 className={dialogTitleCls}>Keyboard shortcuts</h2>
      </div>
      <div className="grid max-h-[60vh] grid-cols-2 gap-7 overflow-y-auto px-7 pt-5.5 pb-2">
        {GROUPS.map((g) => (
          <div key={g.title}>
            <div className="mb-2.5 border-b border-dashed border-rule pb-1.5 text-micro tracking-eyebrow text-ink-mute uppercase">
              {g.title}
            </div>
            {g.items.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between gap-3 py-1.75 text-body"
              >
                <span className="text-ink-dim">{item.label}</span>
                <span className="inline-flex items-center gap-1">
                  {item.keys.map((k, i) => (
                    <span key={i}>
                      {i > 0 && (
                        <span className="mx-0.5 text-tiny text-ink-mute">
                          +
                        </span>
                      )}
                      <Kbd>{k}</Kbd>
                    </span>
                  ))}
                </span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="border-t border-rule px-7 pt-3 pb-4 text-center text-tiny text-ink-mute">
        press esc or click outside to close
      </div>
    </Dialog>
  );
}
