import { Command as CmdkCommand } from "cmdk";
import { motion, AnimatePresence } from "motion/react";
import { useMemo } from "react";
import { useCommands } from "../commands";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: Props) {
  const { commands } = useCommands();

  const grouped = useMemo(() => {
    const map = new Map<string, typeof commands>();
    for (const c of commands) {
      const list = map.get(c.group) ?? [];
      list.push(c);
      map.set(c.group, list);
    }
    return Array.from(map.entries());
  }, [commands]);

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
            className="cmdk-dialog"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", damping: 28, stiffness: 360 }}
            onClick={(e) => e.stopPropagation()}
          >
            <CmdkCommand label="Command palette">
              <CmdkCommand.Input placeholder="what would you like to observe…" autoFocus />
              <CmdkCommand.List>
                <CmdkCommand.Empty>no matching command.</CmdkCommand.Empty>
                {grouped.map(([group, items]) => (
                  <CmdkCommand.Group key={group} heading={group}>
                    {items.map((c) => (
                      <CmdkCommand.Item
                        key={c.id}
                        value={`${c.label} ${(c.keywords ?? []).join(" ")}`}
                        onSelect={() => {
                          c.perform();
                          onClose();
                        }}
                      >
                        {c.icon}
                        <span>{c.label}</span>
                        {c.hint && <span className="cmdk-item-hint">{c.hint}</span>}
                      </CmdkCommand.Item>
                    ))}
                  </CmdkCommand.Group>
                ))}
              </CmdkCommand.List>
            </CmdkCommand>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
