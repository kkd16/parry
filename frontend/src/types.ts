export interface Event {
  id: number;
  timestamp: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  tier: number;
  action: "allow" | "block" | "observe";
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
  default_tier?: number;
  tier_1?: string[];
  tier_2?: string[];
  tier_3?: string[];
  tier_4?: string[];
  tier_5?: string[];
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

export interface Policy {
  version: number;
  mode: string;
  check_mode_confirm: string;
  default_tier: number;
  tiers: Record<string, string>;
  parry_paths?: string[];
  protected_paths?: string[];
  rules: Record<string, Rule>;
  rate_limit?: RateLimit;
  notifications?: Notifications;
}
