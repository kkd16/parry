import type { Action, Rule, RuleEntry } from "../types";

export const ACTIONS: Action[] = ["allow", "confirm", "block"];

export const STRICTNESS: Record<Action, number> = {
  block: 3,
  confirm: 2,
  allow: 1,
};

export function entryLabel(entry: RuleEntry): string {
  const parts = [entry.binary];
  if (entry.positional?.length) parts.push(...entry.positional);
  if (entry.flags?.length) parts.push(`[${entry.flags.join(", ")}]`);
  return parts.join(" ");
}

interface BinaryEntry {
  action: Action;
  positional: string[];
  flags: string[];
  specificity: number;
}

export interface ClusterChip {
  binary: string;
  label: string;
  count: number;
  qualified: boolean;
  searchText: string[];
}

function chipOrder(a: ClusterChip, b: ClusterChip): number {
  if (a.qualified !== b.qualified) return a.qualified ? 1 : -1;
  if (a.count !== b.count) return b.count - a.count;
  return a.binary.localeCompare(b.binary);
}

export function actionClusters(rule: Rule): Record<Action, ClusterChip[]> {
  const out: Record<Action, ClusterChip[]> = {
    allow: [],
    confirm: [],
    block: [],
  };
  for (const action of ACTIONS) {
    const byBinary = new Map<string, RuleEntry[]>();
    for (const e of rule[action] ?? []) {
      const list = byBinary.get(e.binary);
      if (list) list.push(e);
      else byBinary.set(e.binary, [e]);
    }
    const chips: ClusterChip[] = [];
    for (const [binary, entries] of byBinary) {
      chips.push({
        binary,
        label: entries.length === 1 ? entryLabel(entries[0]) : binary,
        count: entries.length,
        qualified: entries.some((e) => e.positional?.length || e.flags?.length),
        searchText: [binary, ...entries.map(entryLabel)].map((s) =>
          s.toLowerCase(),
        ),
      });
    }
    chips.sort(chipOrder);
    out[action] = chips;
  }
  return out;
}

export function chipMatches(chip: ClusterChip, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return chip.searchText.some((s) => s.includes(q));
}

export interface PrecedenceRow {
  label: string;
  action: Action;
  specificity: number;
  reason: string;
}

export interface RuleExample {
  command: string;
  action: string;
  via: string;
}

export interface BinaryExplanation {
  binary: string;
  rows: PrecedenceRow[];
  actions: Action[];
  shellDefault: string;
  flagForms: { name: string; forms: string[] }[];
  examples: RuleExample[];
  yaml: string;
}

function entryToRuleEntry(e: BinaryEntry, binary: string): RuleEntry {
  return { binary, positional: e.positional, flags: e.flags };
}

// mirrors the winner selection in internal/policy/binary.go:
// most specific match wins; strictest action wins specificity ties
function byPrecedence(a: BinaryEntry, b: BinaryEntry): number {
  return (
    b.specificity - a.specificity || STRICTNESS[b.action] - STRICTNESS[a.action]
  );
}

function rowReason(entries: BinaryEntry[], i: number): string {
  if (entries.length === 1) return "the only rule for this binary";
  if (i > 0 && entries[i].specificity === entries[i - 1].specificity) {
    return "ties on specificity, the stricter action wins";
  }
  if (i === 0) return "most specific, checked first";
  return "applies when nothing above matches";
}

function isPrefix(prefix: string[], full: string[]): boolean {
  return prefix.length <= full.length && prefix.every((p, i) => p === full[i]);
}

function isSubset(sub: string[], sup: string[]): boolean {
  return sub.every((f) => sup.includes(f));
}

function winnerFor(e: BinaryEntry, all: BinaryEntry[]): BinaryEntry {
  const candidates = all.filter(
    (s) => isPrefix(s.positional, e.positional) && isSubset(s.flags, e.flags),
  );
  candidates.sort(byPrecedence);
  return candidates[0] ?? e;
}

function formatFlagForm(f: string): string {
  if (f.startsWith("-")) return f;
  return f.length === 1 ? `-${f}` : `--${f}`;
}

function exampleFor(
  e: BinaryEntry,
  all: BinaryEntry[],
  binary: string,
  equivalents: Record<string, string[]> | undefined,
): RuleExample {
  const tokens = [binary, ...e.positional];
  if (e.flags.length) {
    const shorts: string[] = [];
    const longs: string[] = [];
    for (const name of e.flags) {
      const forms = equivalents?.[name] ?? [name];
      const short = forms.find((f) => f.replace(/^-+/, "").length === 1);
      if (short) shorts.push(short.replace(/^-+/, ""));
      else longs.push(formatFlagForm(forms[0]));
    }
    if (shorts.length) tokens.push("-" + shorts.join(""));
    tokens.push(...longs);
    tokens.push("<path>");
  }
  const winner = winnerFor(e, all);
  return {
    command: tokens.join(" "),
    action: winner.action,
    via: entryLabel(entryToRuleEntry(winner, binary)),
  };
}

function yamlScalar(s: string): string {
  if (
    /^(true|false|null|yes|no|on|off|~)$/i.test(s) ||
    /[:#{}[\],&*?|<>=!%@`'"]/.test(s)
  ) {
    return JSON.stringify(s);
  }
  return s;
}

function yamlEntry(e: BinaryEntry, binary: string, indent: string): string {
  let out = `${indent}- binary: ${yamlScalar(binary)}`;
  if (e.positional.length) {
    out += `\n${indent}  positional: [${e.positional.map(yamlScalar).join(", ")}]`;
  }
  if (e.flags.length) {
    out += `\n${indent}  flags: [${e.flags.map(yamlScalar).join(", ")}]`;
  }
  return out;
}

function yamlFor(
  binary: string,
  entries: BinaryEntry[],
  equivalents: Record<string, string[]> | undefined,
): string {
  const lines = ["rules:", "  shell:"];
  const usedFlags = new Set(entries.flatMap((e) => e.flags));
  if (equivalents && usedFlags.size > 0) {
    lines.push("    flag_equivalents:", `      ${yamlScalar(binary)}:`);
    for (const [name, forms] of Object.entries(equivalents)) {
      if (!usedFlags.has(name)) continue;
      lines.push(`        ${name}: [${forms.map(yamlScalar).join(", ")}]`);
    }
  }
  for (const action of ACTIONS) {
    const forAction = entries.filter((e) => e.action === action);
    if (!forAction.length) continue;
    lines.push(`    ${action}:`);
    for (const e of forAction) lines.push(yamlEntry(e, binary, "      "));
  }
  return lines.join("\n");
}

export function explainBinary(
  binary: string,
  rule: Rule,
  globalDefault: string,
): BinaryExplanation {
  const entries: BinaryEntry[] = [];
  for (const action of ACTIONS) {
    for (const e of rule[action] ?? []) {
      if (e.binary !== binary) continue;
      entries.push({
        action,
        positional: e.positional ?? [],
        flags: e.flags ?? [],
        specificity: (e.positional?.length ?? 0) + (e.flags?.length ?? 0),
      });
    }
  }
  entries.sort(byPrecedence);

  const rows: PrecedenceRow[] = entries.map((e, i) => ({
    label: entryLabel(entryToRuleEntry(e, binary)),
    action: e.action,
    specificity: e.specificity,
    reason: rowReason(entries, i),
  }));

  const actions = ACTIONS.filter((a) => entries.some((e) => e.action === a));
  const shellDefault = rule.default_action ?? globalDefault;
  const equivalents = rule.flag_equivalents?.[binary];

  const flagForms = Object.entries(equivalents ?? {})
    .filter(([name]) => entries.some((e) => e.flags.includes(name)))
    .map(([name, forms]) => ({ name, forms: forms.map(formatFlagForm) }));

  const examples: RuleExample[] = [];
  if (entries.length) {
    examples.push(exampleFor(entries[0], entries, binary, equivalents));
    const last = entries[entries.length - 1];
    if (entries.length > 1)
      examples.push(exampleFor(last, entries, binary, equivalents));
  }
  const hasBare = entries.some((e) => e.specificity === 0);
  if (!hasBare) {
    examples.push({
      command: `${binary} <anything else>`,
      action: shellDefault,
      via: `no rule matches, shell default (${shellDefault})`,
    });
  }

  return {
    binary,
    rows,
    actions,
    shellDefault,
    flagForms,
    examples,
    yaml: yamlFor(binary, entries, equivalents),
  };
}
