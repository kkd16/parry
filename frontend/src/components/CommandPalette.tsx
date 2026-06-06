import { Command as CmdkCommand } from "cmdk";
import { useMemo } from "react";
import clsx from "clsx";
import { useCommands } from "../commands";
import Dialog, { dialogPanelCls } from "./Dialog";

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
    <Dialog
      open={open}
      onClose={onClose}
      className={clsx("w-[min(580px,92vw)]", dialogPanelCls)}
    >
      <CmdkCommand label="Command palette">
        <CmdkCommand.Input
          className="w-full border-b border-rule bg-transparent px-5.5 py-4.5 font-mono text-sm text-ink outline-none placeholder:font-display placeholder:text-base placeholder:text-ink-mute placeholder:italic"
          placeholder="what would you like to observe…"
          autoFocus
        />
        <CmdkCommand.List className="max-h-95 overflow-y-auto p-2">
          <CmdkCommand.Empty className="p-8 text-center font-display text-lg text-ink-mute italic">
            no matching command.
          </CmdkCommand.Empty>
          {grouped.map(([group, items]) => (
            <CmdkCommand.Group
              key={group}
              heading={
                <span className="block px-3 pt-3 pb-1.5 font-mono text-eyebrow tracking-[0.2em] text-ink-mute uppercase">
                  {group}
                </span>
              }
            >
              {items.map((c) => (
                <CmdkCommand.Item
                  className="flex cursor-pointer items-center gap-3 rounded px-3 py-2.5 text-body text-ink-dim data-[selected=true]:bg-bg-hover data-[selected=true]:text-ink [&_svg]:h-3.5 [&_svg]:w-3.5 [&_svg]:shrink-0 [&_svg]:text-brass"
                  key={c.id}
                  value={`${c.label} ${(c.keywords ?? []).join(" ")}`}
                  onSelect={() => {
                    c.perform();
                    onClose();
                  }}
                >
                  {c.icon}
                  <span>{c.label}</span>
                  {c.hint && (
                    <span className="ml-auto font-mono text-micro text-ink-mute">
                      {c.hint}
                    </span>
                  )}
                </CmdkCommand.Item>
              ))}
            </CmdkCommand.Group>
          ))}
        </CmdkCommand.List>
      </CmdkCommand>
    </Dialog>
  );
}
