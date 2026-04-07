import { useCallback, useEffect, useState } from "react";

const URL_EVENT = "parry:urlchange";
const subscribers = new Set<() => void>();

function notify() {
  for (const fn of subscribers) fn();
}

if (typeof window !== "undefined") {
  window.addEventListener("popstate", notify);
  window.addEventListener(URL_EVENT, notify);
}

function useUrlSubscription() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const fn = () => setTick((n) => n + 1);
    subscribers.add(fn);
    return () => {
      subscribers.delete(fn);
    };
  }, []);
}

function dispatch() {
  window.dispatchEvent(new Event(URL_EVENT));
}

const VALID_PATHS = new Set(["/bridge", "/logbook", "/orrery", "/charter", "/beacon"]);

function normalizePath(p: string): string {
  if (VALID_PATHS.has(p)) return p;
  return "/bridge";
}

export function usePath(): [string, (next: string) => void] {
  useUrlSubscription();
  const path = normalizePath(
    typeof window === "undefined" ? "/events" : window.location.pathname,
  );
  const setPath = useCallback((next: string) => {
    const target = normalizePath(next);
    if (window.location.pathname === target) return;
    window.history.pushState(null, "", target + window.location.search);
    dispatch();
  }, []);
  return [path, setPath];
}

export function useUrlParam(
  key: string,
  defaultValue = "",
): [string, (next: string) => void] {
  useUrlSubscription();
  const value =
    typeof window === "undefined"
      ? defaultValue
      : (new URLSearchParams(window.location.search).get(key) ?? defaultValue);
  const setValue = useCallback(
    (next: string) => {
      const params = new URLSearchParams(window.location.search);
      if (!next || next === defaultValue) {
        params.delete(key);
      } else {
        params.set(key, next);
      }
      const qs = params.toString();
      const url = window.location.pathname + (qs ? "?" + qs : "");
      window.history.replaceState(null, "", url);
      dispatch();
    },
    [key, defaultValue],
  );
  return [value, setValue];
}

export function useUrlNumber(
  key: string,
  defaultValue = 0,
): [number, (next: number) => void] {
  const [raw, setRaw] = useUrlParam(key, "");
  const value = raw === "" ? defaultValue : Number(raw);
  const setValue = useCallback(
    (next: number) => {
      setRaw(next === defaultValue ? "" : String(next));
    },
    [setRaw, defaultValue],
  );
  return [Number.isFinite(value) ? value : defaultValue, setValue];
}
