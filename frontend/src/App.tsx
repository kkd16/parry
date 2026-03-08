import { useEffect, useState, useCallback } from "react";
import type { Event, EventsResponse } from "./types";

const PAGE_SIZE = 100;

function actionClass(action: string): string {
  switch (action) {
    case "allow":
      return "badge badge-allow";
    case "block":
      return "badge badge-block";
    case "observe":
      return "badge badge-observe";
    default:
      return "badge";
  }
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleString();
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n - 3) + "..." : s;
}

export default function App() {
  const [events, setEvents] = useState<Event[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [actionFilter, setActionFilter] = useState("");
  const [toolFilter, setToolFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(offset),
    });
    if (actionFilter) params.set("action", actionFilter);
    if (toolFilter) params.set("tool", toolFilter);

    try {
      const res = await fetch(`/api/events?${params}`);
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || res.statusText);
      }
      const data: EventsResponse = await res.json();
      setEvents(data.events ?? []);
      setTotal(data.total);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [offset, actionFilter, toolFilter]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  const handleFilterChange = (setter: (v: string) => void) => {
    return (e: React.ChangeEvent<HTMLSelectElement>) => {
      setter(e.target.value);
      setOffset(0);
    };
  };

  const page = Math.floor(offset / PAGE_SIZE) + 1;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="container">
      <header>
        <h1>Parry Dashboard</h1>
        <span className="total">{total} events</span>
      </header>

      <div className="filters">
        <label>
          Action:
          <select value={actionFilter} onChange={handleFilterChange(setActionFilter)}>
            <option value="">All</option>
            <option value="allow">Allow</option>
            <option value="block">Block</option>
            <option value="observe">Observe</option>
          </select>
        </label>
        <label>
          Tool:
          <select value={toolFilter} onChange={handleFilterChange(setToolFilter)}>
            <option value="">All</option>
            <option value="shell">Shell</option>
            <option value="file_edit">File Edit</option>
            <option value="file_read">File Read</option>
            <option value="unknown">Unknown</option>
          </select>
        </label>
      </div>

      {error && <div className="error">{error}</div>}

      {loading ? (
        <div className="loading">Loading...</div>
      ) : (
        <>
          <table>
            <thead>
              <tr>
                <th>Time</th>
                <th>Tool</th>
                <th>Action</th>
                <th>Tier</th>
                <th>Mode</th>
                <th>Session</th>
                <th>Input</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty">
                    No events found
                  </td>
                </tr>
              ) : (
                events.map((ev) => (
                  <tr key={ev.id}>
                    <td className="nowrap">{formatTime(ev.timestamp)}</td>
                    <td>{ev.tool_name}</td>
                    <td>
                      <span className={actionClass(ev.action)}>{ev.action}</span>
                    </td>
                    <td className="center">T{ev.tier}</td>
                    <td>{ev.mode}</td>
                    <td className="mono">{ev.session.slice(0, 8)}</td>
                    <td className="input-cell" title={JSON.stringify(ev.tool_input)}>
                      {truncate(JSON.stringify(ev.tool_input), 60)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="pagination">
              <button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}>
                Prev
              </button>
              <span>
                Page {page} of {totalPages}
              </span>
              <button
                disabled={offset + PAGE_SIZE >= total}
                onClick={() => setOffset(offset + PAGE_SIZE)}
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
