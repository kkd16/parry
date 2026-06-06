export type Action = "allow" | "block" | "confirm";

export interface Event {
  id: number;
  timestamp: string;
  tool_name: string;
  tool_input: Record<string, unknown>;
  action: Action | "observe";
  would_action: Action | "";
  session: string;
  mode: "observe" | "enforce";
  raw_name: string;
  binary: string;
  file: string;
  workdir: string;
}

export interface EventsResponse {
  events: Event[];
  total: number;
}

export interface RuleEntry {
  binary: string;
  positional?: string[];
  flags?: string[];
}

export interface RuleSuggestion {
  tool: string;
  action: Action;
  yaml: string;
  duplicate: boolean;
  warning?: string;
}

export interface Rule {
  default_action?: string;
  flag_equivalents?: Record<string, Record<string, string[]>>;
  allow?: RuleEntry[];
  confirm?: RuleEntry[];
  block?: RuleEntry[];
}

export interface RateLimit {
  window: string;
  max: number;
  on_exceed?: string;
}

export interface Notifications {
  provider: string;
  confirmation_timeout?: string;
  extra?: { ntfy?: { topic?: string; server?: string } };
}

export interface NotifyHealth {
  status: "ok" | "error" | "unconfigured";
  provider?: string;
  topic?: string;
  server?: string;
  error?: string;
}

export interface MatchedRule {
  action: Action;
  entry?: RuleEntry;
  specificity: number;
  is_default: boolean;
}

export interface CommandExplanation {
  binary: string;
  action: Action;
  matched: MatchedRule;
}

export interface ProtectedHit {
  pattern: string;
  arg: string;
}

export interface Explanation {
  action: Action;
  tool: string;
  default: string;
  unresolved: boolean;
  protected?: ProtectedHit;
  commands?: CommandExplanation[];
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

export interface BinaryStat {
  binary: string;
  count: number;
  actions: Record<string, number>;
}

export interface DayBucket {
  date: string;
  count: number;
}

export interface ActionCount {
  action: string;
  count: number;
}

export interface ProjectStat {
  workdir: string;
  count: number;
}

export interface OverviewResponse {
  total: number;
  today: number;
  blocked_today: number;
  last_7d: DayBucket[];
  by_action: ActionCount[];
  top_binaries: BinaryStat[];
  top_project?: ProjectStat;
  recent_blocks: Event[];
}

export interface HeatmapProject {
  workdir: string;
  files: { path: string; count: number }[];
  total: number;
  fileCount: number;
}

export interface HeatmapResponse {
  projects: HeatmapProject[];
}

export interface AboutInfo {
  version: string;
  go_version: string;
  commit: string;
  built: string;
  platform: string;
  data_dir: string;
}

export interface NotifyTestResult {
  ok: boolean;
  error?: string;
}

export interface DashboardCounts {
  today: number | null;
  blockedToday: number | null;
  projects: number | null;
}
