import { X } from "lucide-react";

interface Chip {
  label: string;
  value: string;
  onClear: () => void;
}

interface Props {
  chips: Chip[];
  onClearAll: () => void;
}

export default function FilterChips({ chips, onClearAll }: Props) {
  if (chips.length === 0) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5 font-mono">
      <span className="mr-1.5 text-eyebrow tracking-[0.18em] text-ink-mute uppercase">
        filtered
      </span>
      {chips.map((c) => (
        <button
          key={c.label + c.value}
          className="inline-flex items-center gap-1.5 rounded-xl border border-brass-dim bg-brass/10 px-2.5 py-[3px] text-[0.7rem] text-brass-bright hover:border-brass hover:bg-brass/18"
          onClick={c.onClear}
        >
          <span className="text-eyebrow tracking-[0.12em] text-ink-mute uppercase">
            {c.label}
          </span>
          <span className="max-w-[220px] truncate text-brass-bright">
            {c.value}
          </span>
          <X size={11} />
        </button>
      ))}
      <button
        className="ml-1.5 font-mono text-tiny tracking-[0.12em] text-ink-mute uppercase hover:text-brass"
        onClick={onClearAll}
      >
        clear all
      </button>
    </div>
  );
}
