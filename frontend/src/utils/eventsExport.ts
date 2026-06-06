import type { Event } from "../types";

export function shortJson(v: unknown, n = 60): string {
  const s = JSON.stringify(v) ?? "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

function csvEscape(v: string): string {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export function downloadJson(events: Event[]) {
  const blob = new Blob([JSON.stringify(events, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `parry-events-${new Date().toISOString().slice(0, 19)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadCsv(events: Event[]) {
  const cols: (keyof Event)[] = [
    "timestamp",
    "tool_name",
    "raw_name",
    "binary",
    "action",
    "would_action",
    "mode",
    "workdir",
    "file",
    "session",
  ];
  const header = cols.join(",");
  const rows = events.map((e) =>
    cols
      .map((c) => {
        const v = e[c];
        return csvEscape(typeof v === "string" ? v : String(v ?? ""));
      })
      .join(","),
  );
  const csv = [header, ...rows, ""].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `parry-events-${new Date().toISOString().slice(0, 19)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
