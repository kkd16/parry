import { Command } from "cmdk";
import { motion, AnimatePresence } from "motion/react";
import { BookOpen, Orbit, ScrollText, Filter, Search } from "lucide-react";
import type { Tab } from "../App";

interface Props {
  open: boolean;
  onClose: () => void;
  onNav: (tab: Tab) => void;
  onQuickFilter: (filter: QuickFilter) => void;
}

export type QuickFilter =
  | { kind: "action"; value: "allow" | "block" | "observe" | "confirm" }
  | { kind: "tool"; value: "shell" | "file_edit" | "file_read" }
  | { kind: "time"; value: "1h" | "24h" | "7d" };

export default function CommandPalette({ open, onClose, onNav, onQuickFilter }: Props) {
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
            <Command label="Command palette">
              <Command.Input placeholder="what would you like to observe…" autoFocus />
              <Command.List>
                <Command.Empty>no matching command.</Command.Empty>
                <Command.Group heading="Navigate">
                  <Command.Item
                    onSelect={() => {
                      onNav("events");
                      onClose();
                    }}
                  >
                    <ScrollText /> Go to Logbook
                    <span className="cmdk-item-hint">g e</span>
                  </Command.Item>
                  <Command.Item
                    onSelect={() => {
                      onNav("solar");
                      onClose();
                    }}
                  >
                    <Orbit /> Go to Orrery
                    <span className="cmdk-item-hint">g s</span>
                  </Command.Item>
                  <Command.Item
                    onSelect={() => {
                      onNav("policy");
                      onClose();
                    }}
                  >
                    <BookOpen /> Go to Charter
                    <span className="cmdk-item-hint">g p</span>
                  </Command.Item>
                </Command.Group>
                <Command.Group heading="Filter events">
                  <Command.Item
                    onSelect={() => {
                      onQuickFilter({ kind: "action", value: "block" });
                      onNav("events");
                      onClose();
                    }}
                  >
                    <Filter /> Show blocked events
                  </Command.Item>
                  <Command.Item
                    onSelect={() => {
                      onQuickFilter({ kind: "action", value: "confirm" });
                      onNav("events");
                      onClose();
                    }}
                  >
                    <Filter /> Show confirm events
                  </Command.Item>
                  <Command.Item
                    onSelect={() => {
                      onQuickFilter({ kind: "tool", value: "shell" });
                      onNav("events");
                      onClose();
                    }}
                  >
                    <Filter /> Shell calls only
                  </Command.Item>
                  <Command.Item
                    onSelect={() => {
                      onQuickFilter({ kind: "tool", value: "file_edit" });
                      onNav("events");
                      onClose();
                    }}
                  >
                    <Filter /> File edits only
                  </Command.Item>
                  <Command.Item
                    onSelect={() => {
                      onQuickFilter({ kind: "time", value: "1h" });
                      onNav("events");
                      onClose();
                    }}
                  >
                    <Search /> Last hour
                  </Command.Item>
                  <Command.Item
                    onSelect={() => {
                      onQuickFilter({ kind: "time", value: "24h" });
                      onNav("events");
                      onClose();
                    }}
                  >
                    <Search /> Last 24 hours
                  </Command.Item>
                </Command.Group>
              </Command.List>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
