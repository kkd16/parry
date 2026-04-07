import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

interface Props {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}

export default function SearchableSelect({ label, value, options, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setTimeout(() => inputRef.current?.focus(), 0);
    const click = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", click);
    return () => document.removeEventListener("mousedown", click);
  }, [open]);

  const openMenu = () => {
    setQuery("");
    setOpen((v) => !v);
  };

  const filtered = query
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  const display = value || `${label}: all`;

  return (
    <div className="searchable-select" ref={wrapRef}>
      <button className="input searchable-select-trigger" onClick={openMenu}>
        <span className="searchable-select-value">{display}</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="searchable-select-menu">
          <input
            ref={inputRef}
            className="input searchable-select-search"
            placeholder={`search ${label}…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setOpen(false);
              if (e.key === "Enter" && filtered[0]) {
                onChange(filtered[0]);
                setOpen(false);
              }
            }}
          />
          <div className="searchable-select-list">
            <button
              className={`searchable-select-item${value === "" ? " active" : ""}`}
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              <span className="muted">all</span>
            </button>
            {filtered.length === 0 ? (
              <div className="searchable-select-empty">no matches</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o}
                  className={`searchable-select-item${value === o ? " active" : ""}`}
                  onClick={() => {
                    onChange(o);
                    setOpen(false);
                  }}
                >
                  {o}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
