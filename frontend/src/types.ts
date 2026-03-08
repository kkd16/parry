export interface Event {
  id: number;
  timestamp: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  tier: number;
  action: "allow" | "block" | "observe";
  session: string;
  mode: "observe" | "enforce";
}

export interface EventsResponse {
  events: Event[];
  total: number;
  limit: number;
  offset: number;
}
