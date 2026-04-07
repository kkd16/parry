import { useEffect, useState } from "react";

export function formatRelative(ts: string, now = Date.now()): string {
  const t = new Date(ts).getTime();
  if (Number.isNaN(t)) return ts;
  const diff = now - t;
  if (diff < 0) return "just now";
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return "now";
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) {
    const time = new Date(t).toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
    return `yesterday ${time}`;
  }
  if (day < 7) return `${day}d ago`;
  return new Date(t).toLocaleDateString([], { month: "short", day: "numeric" });
}

export function formatAbsolute(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString();
}

export function useNowTick(intervalMs = 30_000): number {
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setTick(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return tick;
}
