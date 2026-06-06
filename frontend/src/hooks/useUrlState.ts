import { useCallback, useEffect, useState } from "react";
import { TABS } from "../tabs";

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

const VALID_PATHS = new Set(TABS.map((t) => "/" + t.id));

function normalizePath(p: string): string {
  if (VALID_PATHS.has(p)) return p;
  return "/bridge";
}

export function openUrl(url: string) {
  window.history.pushState(null, "", url);
  dispatch();
}

export function setUrlParams(updates: Record<string, string>) {
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(updates)) {
    if (value) params.set(key, value);
    else params.delete(key);
  }
  const qs = params.toString();
  window.history.replaceState(null, "", window.location.pathname + (qs ? "?" + qs : ""));
  dispatch();
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
      setUrlParams({ [key]: next === defaultValue ? "" : next });
    },
    [key, defaultValue],
  );
  return [value, setValue];
}

export function useUrlParams<K extends string>(
  keys: readonly K[],
): [Record<K, string>, (updates: Partial<Record<K, string>>) => void] {
  useUrlSubscription();
  const params = new URLSearchParams(
    typeof window === "undefined" ? "" : window.location.search,
  );
  const values = {} as Record<K, string>;
  for (const k of keys) values[k] = params.get(k) ?? "";
  const setValues = useCallback((updates: Partial<Record<K, string>>) => {
    setUrlParams(updates as Record<string, string>);
  }, []);
  return [values, setValues];
}
