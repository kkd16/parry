import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { inputCls, Muted } from "./ui";
import { useClickOutside } from "../hooks/useClickOutside";

interface Props {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}

const itemCls =
  "block w-full truncate rounded px-2.5 py-1.75 text-left text-meta text-ink hover:bg-bg-hover hover:text-brass focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-brass";

export default function SearchableSelect({
  label,
  value,
  options,
  onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const wrapRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);
  useClickOutside(wrapRef, open, () => setOpen(false));

  const openMenu = () => {
    setQuery("");
    setOpen((v) => !v);
  };

  const filtered = query
    ? options.filter((o) => o.toLowerCase().includes(query.toLowerCase()))
    : options;

  const display = value || `${label}: all`;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        className={clsx(
          inputCls,
          "inline-flex min-w-32.5 cursor-pointer items-center gap-2 text-left focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-brass [&_svg]:shrink-0 [&_svg]:text-ink-mute",
        )}
        onClick={openMenu}
      >
        <span className="flex-1 truncate">{display}</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute top-full left-0 z-30 mt-1 max-w-105 min-w-65 overflow-hidden rounded border border-rule bg-bg-raised shadow-float">
          <input
            ref={inputRef}
            className="w-full border-b border-rule bg-bg px-3 py-2.5 text-body text-ink outline-none placeholder:text-ink-mute placeholder:italic focus:border-b-brass"
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
          <div className="max-h-70 overflow-y-auto p-1">
            <button
              className={clsx(
                itemCls,
                value === "" && "bg-brass/10 text-brass-bright",
              )}
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
            >
              <Muted>all</Muted>
            </button>
            {filtered.length === 0 ? (
              <div className="p-3.5 text-center font-display text-sm text-ink-mute italic">
                no matches
              </div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o}
                  className={clsx(
                    itemCls,
                    value === o && "bg-brass/10 text-brass-bright",
                  )}
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
