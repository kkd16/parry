import { Command as CmdkCommand } from "cmdk";
import { useMemo } from "react";
import { useCommands } from "../commands";
import Dialog from "./Dialog";
import "./CommandPalette.css";

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
    <Dialog open={open} onClose={onClose} className="cmdk-dialog">
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
    </Dialog>
  );
}
