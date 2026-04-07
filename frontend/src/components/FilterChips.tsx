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
    <div className="filter-chips">
      <span className="filter-chips-label">filtered</span>
      {chips.map((c) => (
        <button key={c.label + c.value} className="filter-chip" onClick={c.onClear}>
          <span className="filter-chip-key">{c.label}</span>
          <span className="filter-chip-value">{c.value}</span>
          <X size={11} />
        </button>
      ))}
      <button className="filter-chips-clear" onClick={onClearAll}>
        clear all
      </button>
    </div>
  );
}
