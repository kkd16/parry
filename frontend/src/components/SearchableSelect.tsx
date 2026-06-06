import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ChevronDown } from "lucide-react";
import { inputCls } from "./ui";

interface Props {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}

const itemCls =
  "block w-full truncate rounded-[3px] px-2.5 py-[7px] text-left font-mono text-[0.74rem] whitespace-nowrap text-ink hover:bg-bg-hover hover:text-brass";

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
    if (!open) return;
    setTimeout(() => inputRef.current?.focus(), 0);
    const click = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node))
        setOpen(false);
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
    <div className="relative" ref={wrapRef}>
      <button
        className={clsx(
          inputCls,
          "inline-flex min-w-[130px] cursor-pointer items-center gap-2 text-left [&_svg]:shrink-0 [&_svg]:text-ink-mute",
        )}
        onClick={openMenu}
      >
        <span className="flex-1 truncate">{display}</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute top-[calc(100%+4px)] left-0 z-30 max-w-[420px] min-w-[260px] overflow-hidden rounded border border-rule bg-bg-raised shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
          <input
            ref={inputRef}
            className="w-full border-b border-rule bg-bg px-3 py-2.5 font-mono text-body text-ink outline-none placeholder:text-ink-mute placeholder:italic focus:border-b-brass"
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
          <div className="max-h-[280px] overflow-y-auto p-1">
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
              <span className="text-ink-mute italic">all</span>
            </button>
            {filtered.length === 0 ? (
              <div className="p-3.5 text-center font-display text-[0.85rem] text-ink-mute italic">
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
