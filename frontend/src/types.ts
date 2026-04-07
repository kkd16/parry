export interface Event {
  id: number;
  timestamp: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  action: "allow" | "block" | "confirm" | "observe";
  session: string;
  mode: "observe" | "enforce";
  raw_name: string;
  binary: string;
  subcommand: string;
  file: string;
  workdir: string;
}

export interface EventsResponse {
  events: Event[];
  total: number;
  limit: number;
  offset: number;
}

export interface Rule {
  default_action?: string;
  allow?: string[];
  confirm?: string[];
  block?: string[];
}

export interface RateLimit {
  window: string;
  max: number;
  on_exceed?: string;
}

export interface Notifications {
  provider: string;
  confirmation_timeout?: string;
  extra?: Record<string, unknown>;
}

export interface NotifyHealth {
  status: "ok" | "error" | "unconfigured";
  provider?: string;
  topic?: string;
  server?: string;
  error?: string;
}

export interface Policy {
  version: number;
  mode: string;
  check_mode_confirm: string;
  default_action: string;
  parry_paths?: string[];
  protected_paths?: string[];
  rules: Record<string, Rule>;
  rate_limit?: RateLimit;
  notifications?: Notifications;
}
