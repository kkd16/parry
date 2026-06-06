export type NodeStatus = "shipped" | "planned";
export type EdgeKind = "main" | "tap";
export type Accent = "neutral" | "allow" | "confirm" | "block" | "brass";

export interface SubComponent {
  name: string;
  oneliner?: string;
  status?: NodeStatus;
}

export type DetailBlock =
  | { kind: "para"; text: string }
  | { kind: "packages"; label?: string; paths: string[] }
  | { kind: "components"; label?: string; items: SubComponent[] }
  | { kind: "note"; tone: "planned" | "info"; text: string };

export interface DocNode {
  id: string;
  title: string;
  oneliner: string;
  status: NodeStatus;
  lane: number;
  order: number;
  pkgHint?: string;
  accent?: Accent;
  detail: DetailBlock[];
  seeAlso?: string[];
}

export interface DocEdge {
  from: string;
  to: string;
  kind: EdgeKind;
  label?: string;
}

export const DOC_NODES: DocNode[] = [
  {
    id: "agent",
    title: "Agent",
    oneliner: "Claude Code or Cursor, about to run a tool call",
    status: "shipped",
    lane: 0,
    order: 0,
    pkgHint: "pre-tool-use hook",
    detail: [
      {
        kind: "para",
        text: "Every tool call an agent makes — a shell command, a file edit, a file read — fires a pre-tool-use hook before it executes. The hook pipes the tool-call JSON to parry check and waits for a verdict.",
      },
      {
        kind: "para",
        text: "Parry runs outside the agent process. The agent cannot override, ignore, or reason its way around the decision; by the time the model sees anything, enforcement has already happened.",
      },
      {
        kind: "packages",
        label: "hook configuration",
        paths: [
          "~/.claude/settings.json · PreToolUse",
          "~/.cursor/hooks.json · preToolUse",
        ],
      },
    ],
    seeAlso: ["check"],
  },
  {
    id: "check",
    title: "parry check",
    oneliner: "reads the tool call on stdin, answers with a verdict on stdout",
    status: "shipped",
    lane: 1,
    order: 0,
    pkgHint: "cmd/parry",
    accent: "brass",
    detail: [
      {
        kind: "para",
        text: "The single enforcement entrypoint. Reads hook JSON on stdin, runs the decision pipeline, and prints a verdict the agent understands. Exit code 2 blocks the call outright.",
      },
      {
        kind: "para",
        text: "Fail closed: if Parry crashes or the policy cannot load, the tool call is blocked. Silent failure is never an option for enforcement software.",
      },
      { kind: "packages", paths: ["cmd/parry", "internal/check"] },
    ],
    seeAlso: ["normalize", "verdict"],
  },
  {
    id: "normalize",
    title: "Interception",
    oneliner: "normalizes per-agent payloads into one canonical ToolCall",
    status: "shipped",
    lane: 2,
    order: 0,
    pkgHint: "internal/agents",
    detail: [
      {
        kind: "para",
        text: "Each agent names its tools differently (Bash vs Shell, Edit vs Write). A per-agent mapping table folds them into canonical tools — shell, file_edit, file_read — so one policy file works across every integration.",
      },
      {
        kind: "para",
        text: "Unmapped tools, including MCP tools, classify as unknown. The original tool name is preserved for the audit log.",
      },
      {
        kind: "components",
        label: "integrations",
        items: [
          {
            name: "Claude Code",
            oneliner: "PreToolUse hook, installed by parry config hook claude",
          },
          { name: "Cursor", oneliner: "preToolUse hook with failClosed: true" },
          { name: "GitHub Copilot", status: "planned" },
        ],
      },
      { kind: "packages", paths: ["internal/agents", "internal/check"] },
    ],
    seeAlso: ["classify", "proxy"],
  },
  {
    id: "proxy",
    title: "Proxy mode",
    oneliner: "MCP man-in-the-middle: wrap any tool server",
    status: "planned",
    lane: 2,
    order: 1,
    pkgHint: "internal/proxy",
    detail: [
      { kind: "note", tone: "planned", text: "Phase 2 — not yet implemented." },
      {
        kind: "para",
        text: "parry wrap will sit between the agent and real MCP servers (stdio or HTTP), forwarding JSON-RPC and intercepting every tools/call with the same policy engine check mode uses today.",
      },
    ],
    seeAlso: ["normalize"],
  },
  {
    id: "classify",
    title: "Classification",
    oneliner: "parses shell commands into structured form via an AST walk",
    status: "shipped",
    lane: 3,
    order: 0,
    pkgHint: "internal/shellparse",
    detail: [
      {
        kind: "para",
        text: "Shell commands are parsed with mvdan.cc/sh into a full AST — pipes, && chains, subshells, bash -c wrappers — and every stage becomes a structured Command{Binary, Positional, ShortFlags, LongFlags}.",
      },
      {
        kind: "para",
        text: "Classification is structural, not string matching: rm -rf, rm -fr, rm -r -f, and /bin/rm --recursive --force all resolve to the same shape. Arguments that cannot be resolved statically mark the command unresolved and short-circuit to block.",
      },
      { kind: "packages", paths: ["internal/shellparse"] },
    ],
    seeAlso: ["enforce", "scanner"],
  },
  {
    id: "scanner",
    title: "Injection scanner",
    oneliner: "ONNX prompt-injection scoring for tool inputs and results",
    status: "planned",
    lane: 3,
    order: 1,
    pkgHint: "internal/scanner",
    detail: [
      { kind: "note", tone: "planned", text: "Phase 4 — not yet implemented." },
      {
        kind: "para",
        text: "A local DeBERTa-v3 model (~5ms per inference) will score tool inputs and MCP results for prompt injection. ML provides signals only — deterministic rules still make every enforcement decision.",
      },
    ],
    seeAlso: ["classify"],
  },
  {
    id: "enforce",
    title: "Enforcement",
    oneliner: "policy rules decide: allow, confirm, or block",
    status: "shipped",
    lane: 4,
    order: 0,
    pkgHint: "internal/policy",
    detail: [
      {
        kind: "para",
        text: "The YAML policy compiles at load time into per-binary matchers. A match requires exact binary equality, a positional prefix, and flag-set intersection through semantic flag equivalents; the most specific rule wins, strictest on ties.",
      },
      {
        kind: "para",
        text: "Protected paths (~/.ssh, ~/.aws, …) are checked across all tools before rule matching. Compound commands take the strictest verdict of any pipeline stage.",
      },
      {
        kind: "components",
        items: [
          {
            name: "compiled matchers",
            oneliner: "structured {binary, positional, flags} rules",
          },
          {
            name: "protected paths",
            oneliner: "one list, enforced across every tool",
          },
          {
            name: "flag equivalents",
            oneliner: "semantic names cover every flag spelling",
          },
          {
            name: "decide pipeline",
            oneliner: "policy + rate limit + notify + store",
          },
        ],
      },
      { kind: "packages", paths: ["internal/policy", "internal/runtime"] },
    ],
    seeAlso: ["ratelimit", "confirm", "store"],
  },
  {
    id: "ratelimit",
    title: "Rate limiter",
    oneliner: "sliding window per session, stateful via SQLite",
    status: "shipped",
    lane: 4,
    order: 1,
    pkgHint: "internal/runtime",
    detail: [
      {
        kind: "para",
        text: "Sessions derive from the working directory, so agents in different projects get separate budgets automatically. Exceeding the window triggers the configured on_exceed action (default: block) — defense in depth against a compromised agent moving fast.",
      },
      { kind: "packages", paths: ["internal/runtime", "internal/store"] },
    ],
    seeAlso: ["enforce"],
  },
  {
    id: "confirm",
    title: "Confirmation",
    oneliner: "pauses the tool call until a human approves",
    status: "shipped",
    lane: 5,
    order: 0,
    pkgHint: "internal/notify",
    accent: "confirm",
    detail: [
      {
        kind: "para",
        text: "A confirm verdict holds the hook process open and pushes an approval request through the configured notifier. Approve and the call proceeds; deny, time out, or run without a notifier and it blocks — fail closed.",
      },
      {
        kind: "components",
        label: "notifiers",
        items: [
          {
            name: "system",
            oneliner: "OS-native notifications, zero setup — the default",
          },
          {
            name: "ntfy",
            oneliner: "self-hostable push, approve from your phone",
          },
          { name: "slack", status: "planned" },
        ],
      },
      { kind: "packages", paths: ["internal/notify"] },
    ],
    seeAlso: ["verdict", "enforce"],
  },
  {
    id: "store",
    title: "Audit log",
    oneliner: "every decision logged to SQLite before anything forwards",
    status: "shipped",
    lane: 5,
    order: 1,
    pkgHint: "internal/store",
    detail: [
      {
        kind: "para",
        text: "An immutable audit log of every tool call and verdict — timestamp, session, binary, action, mode. Exportable as JSON or CSV from the dashboard.",
      },
      { kind: "packages", paths: ["internal/store"] },
    ],
    seeAlso: ["dashboard", "enforce"],
  },
  {
    id: "dashboard",
    title: "Dashboard",
    oneliner: "embedded React UI over the audit log",
    status: "shipped",
    lane: 6,
    order: 1,
    pkgHint: "internal/dashboard",
    detail: [
      {
        kind: "para",
        text: "A REST API plus this frontend, embedded in the binary via go:embed — no separate install. Timeline, policy explorer, file-access map, notification health, and this page.",
      },
      { kind: "packages", paths: ["internal/dashboard", "frontend/"] },
    ],
    seeAlso: ["store"],
  },
  {
    id: "verdict",
    title: "Verdict",
    oneliner: "allow / confirm / block on stdout — fail closed",
    status: "shipped",
    lane: 6,
    order: 0,
    pkgHint: "stdout JSON",
    accent: "block",
    detail: [
      {
        kind: "para",
        text: "The decision returns to the agent as hook JSON: allow lets the tool call run, block refuses it with a reason the model can read. Anything unmatched falls through to the configured default action.",
      },
      {
        kind: "para",
        text: "In observe mode verdicts are logged but not enforced — install, watch the dashboard for a few days, then flip to enforce.",
      },
      { kind: "packages", paths: ["internal/check"] },
    ],
    seeAlso: ["agent", "check"],
  },
];

export const DOC_EDGES: DocEdge[] = [
  { from: "agent", to: "check", kind: "main", label: "stdin" },
  { from: "check", to: "normalize", kind: "main" },
  { from: "normalize", to: "classify", kind: "main" },
  { from: "classify", to: "enforce", kind: "main" },
  { from: "enforce", to: "confirm", kind: "main" },
  { from: "confirm", to: "verdict", kind: "main" },
  { from: "verdict", to: "agent", kind: "main", label: "stdout" },
  { from: "enforce", to: "ratelimit", kind: "tap" },
  { from: "enforce", to: "store", kind: "tap", label: "audit" },
  { from: "store", to: "dashboard", kind: "tap" },
  { from: "normalize", to: "proxy", kind: "tap" },
  { from: "classify", to: "scanner", kind: "tap" },
];

export function nodeById(id: string): DocNode | undefined {
  return DOC_NODES.find((n) => n.id === id);
}

const NODE_W = 168;
const NODE_H = 62;
const LANE_GAP_X = 80;
const ROW_GAP_Y = 90;
const PAD = 40;

export interface PlacedNode extends DocNode {
  x: number;
  y: number;
  w: number;
  h: number;
  cx: number;
  cy: number;
}

export function layoutDocs(nodes: DocNode[]): {
  placed: PlacedNode[];
  width: number;
  height: number;
} {
  const placed = nodes.map((n) => {
    const x = PAD + n.lane * (NODE_W + LANE_GAP_X);
    const y = PAD + n.order * (NODE_H + ROW_GAP_Y);
    return {
      ...n,
      x,
      y,
      w: NODE_W,
      h: NODE_H,
      cx: x + NODE_W / 2,
      cy: y + NODE_H / 2,
    };
  });
  const maxLane = Math.max(...nodes.map((n) => n.lane));
  const maxOrder = Math.max(...nodes.map((n) => n.order));
  const width = PAD * 2 + (maxLane + 1) * NODE_W + maxLane * LANE_GAP_X;
  const height = PAD * 2 + (maxOrder + 1) * NODE_H + maxOrder * ROW_GAP_Y;
  return { placed, width, height };
}
