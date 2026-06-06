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
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      <span className="mr-1.5 text-eyebrow tracking-eyebrow text-ink-mute uppercase">
        filtered
      </span>
      {chips.map((c) => (
        <button
          key={c.label + c.value}
          className="inline-flex items-center gap-1.5 rounded-xl border border-brass-dim bg-brass/10 px-2.5 py-0.75 text-meta text-brass-bright focus-ring hover:border-brass hover:bg-brass/18"
          onClick={c.onClear}
        >
          <span className="text-eyebrow tracking-label text-ink-mute uppercase">
            {c.label}
          </span>
          <span className="max-w-55 truncate text-brass-bright">{c.value}</span>
          <X size={11} />
        </button>
      ))}
      <button
        className="ml-1.5 text-tiny tracking-label text-ink-mute uppercase focus-ring hover:text-brass"
        onClick={onClearAll}
      >
        clear all
      </button>
    </div>
  );
}
