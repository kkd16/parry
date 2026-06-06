import type {
  AboutInfo,
  EventsResponse,
  Explanation,
  HeatmapResponse,
  NotifyHealth,
  NotifyTestResult,
  OverviewResponse,
  Policy,
  RuleSuggestion,
} from "./types";

function extractError(text: string): string {
  try {
    const data = JSON.parse(text) as { error?: unknown };
    if (typeof data.error === "string") return data.error;
  } catch {
    return text;
  }
  return text;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    throw new Error(extractError(await res.text()) || res.statusText);
  }
  return res.json() as Promise<T>;
}

export function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

export function getEvents(
  params: URLSearchParams | string,
  signal?: AbortSignal,
): Promise<EventsResponse> {
  return request(`/api/events?${params}`, { signal });
}

export async function getOverview(signal?: AbortSignal): Promise<OverviewResponse> {
  const data = await request<OverviewResponse & { error?: string }>("/api/overview", { signal });
  if (data.error) throw new Error(data.error);
  return data;
}

export async function getHeatmap(signal?: AbortSignal): Promise<HeatmapResponse> {
  const data = await request<HeatmapResponse & { error?: string }>("/api/heatmap", { signal });
  if (data.error) throw new Error(data.error);
  return data;
}

export function getPolicy(signal?: AbortSignal): Promise<Policy> {
  return request("/api/policy", { signal });
}

export function getNotifyHealth(signal?: AbortSignal): Promise<NotifyHealth> {
  return request("/api/notify/health", { signal });
}

export function getAbout(signal?: AbortSignal): Promise<AboutInfo> {
  return request("/api/about", { signal });
}

export function getRuleSuggestion(
  eventId: number,
  action: string,
  signal?: AbortSignal,
): Promise<RuleSuggestion> {
  const params = new URLSearchParams({ event_id: String(eventId), action });
  return request(`/api/rule-suggestion?${params}`, { signal });
}

export function postNotifyTest(signal?: AbortSignal): Promise<NotifyTestResult> {
  return request("/api/notify/test", { method: "POST", signal });
}

export function postPolicyEvaluate(
  body: { tool: string; tool_input: Record<string, unknown> },
  signal?: AbortSignal,
): Promise<Explanation> {
  return request("/api/policy/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
}
