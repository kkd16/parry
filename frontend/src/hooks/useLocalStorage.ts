import { useCallback, useEffect, useRef, useState } from "react";

const listeners = new Map<string, Set<(value: unknown) => void>>();

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw != null) return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
  return fallback;
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    return;
  }
}

export function useLocalStorage<T>(
  key: string,
  initial: T,
): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => read(key, initial));
  const ref = useRef(value);

  useEffect(() => {
    const fn = (v: unknown) => {
      ref.current = v as T;
      setValue(v as T);
    };
    let set = listeners.get(key);
    if (!set) {
      set = new Set();
      listeners.set(key, set);
    }
    set.add(fn);
    return () => {
      set.delete(fn);
    };
  }, [key]);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved =
        typeof next === "function" ? (next as (p: T) => T)(ref.current) : next;
      ref.current = resolved;
      write(key, resolved);
      setValue(resolved);
      for (const fn of listeners.get(key) ?? []) fn(resolved);
    },
    [key],
  );

  return [value, set];
}
