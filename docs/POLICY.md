# Writing a Parry Policy

Parry's policy file lives at `~/.parry/policy.yaml`. It controls which tool calls are allowed, which prompt for confirmation, and which are blocked outright.

## Quick reference

```yaml
version: 1
mode: observe                 # observe | enforce
check_mode_confirm: block     # what "confirm" means when no notifier is wired up
default_action: confirm       # fallback for unmatched tools

protected_paths:              # off limits to every tool, regardless of action
  - "~/.ssh/*"
  - ".env"

rules:
  shell:
    default_action: confirm

    flag_equivalents:
      rm:
        recursive: [r, R, --recursive]
        force:     [f, --force]
      chmod:
        recursive: [R, --recursive]

    allow:
      - binary: ls
      - binary: git
        positional: [status]

    confirm:
      - binary: rm
      - binary: git
        positional: [push]

    block:
      - binary: bash
      - binary: sudo
      - binary: rm
        flags: [recursive, force]
      - binary: chmod
        flags: [recursive]

  file_edit:
    default_action: allow
  file_read:
    default_action: allow

rate_limit:
  window: 3m
  max: 50
```

## Concepts

- **Actions**: `allow`, `confirm`, `block`. Confirm pauses the tool call until you approve from the configured notifier (or falls back to `check_mode_confirm`).
- **Rules**: one entry per canonical tool (`shell`, `file_edit`, `file_read`). Each rule has a `default_action` plus optional `allow` / `confirm` / `block` lists.
- **Shell rules are structured objects**, not strings. Each entry specifies a `binary` and, optionally, a `positional` prefix and a list of semantic `flags`.
- **Protected paths**: enforced across every rule. A `cat ~/.ssh/id_rsa` is blocked even though `cat` is allowed.
- **Rate limit**: per-session, per-tool sliding window. Exceeding it blocks further calls until the window rolls.

## Shell rule entries

A shell rule entry is a map with one required field and two optional fields:

```yaml
- binary: rm                  # required: canonical binary name
  positional: [status]        # optional: positional prefix tokens (e.g. for `git status`)
  flags: [recursive, force]   # optional: semantic flag names (see flag_equivalents)
```

A command matches an entry when **all** of these hold:

1. The command's binary equals `binary` (absolute paths are canonicalized: `/bin/rm` matches `rm`).
2. Every token in `positional` appears in order at the start of the command's non-flag arguments.
3. Every name in `flags` resolves (via the rule's `flag_equivalents` table) to a form present in the command.

### Semantic flag names

`flag_equivalents` declares per-binary what actual short/long flag characters satisfy a semantic flag name. This lets one rule cover every variant of the same intent:

```yaml
flag_equivalents:
  rm:
    recursive: [r, R, --recursive]
    force:     [f, --force]
```

Given that table, the rule

```yaml
- binary: rm
  flags: [recursive, force]
```

matches every recursive-force permutation: `rm -rf`, `rm -fr`, `rm -Rf`, `rm -r -f`, `rm -rvf` (superset), `rm --recursive --force`, `rm -R --force`, `/bin/rm -rf`, `bash -c 'rm --recursive --force /'`, and so on.

**Entries in `flag_equivalents`** are single characters (short flags) or multi-character tokens (long flags; the `--` prefix is optional). Policy load fails if a rule references a flag name that isn't defined in `flag_equivalents` for that binary, so typos are caught eagerly.

### Positional prefix matching

`positional` is matched against the command's positional arguments (after flags are removed) **as a prefix, in source order**. So `{binary: git, positional: [status]}` matches `git status`, `git status --short`, and `git status -uno`, but not `git log`.

### Tiebreaker

When multiple entries match a command, the **most specific** wins — specificity is `len(positional) + len(flags)`. If two entries tie on specificity, the **strictest action** wins (block > confirm > allow). This is deterministic and doesn't depend on the order entries appear in the YAML.

### Migration from the old string form

If you're coming from the old string-list syntax, here's how it maps:

| Old | New |
|---|---|
| `allow: [ls, cat]` | `allow: [{binary: ls}, {binary: cat}]` |
| `allow: ["git status"]` | `allow: [{binary: git, positional: [status]}]` |
| `block: ["rm -rf"]` | `block: [{binary: rm, flags: [recursive, force]}]` (requires `flag_equivalents.rm.recursive` and `.force`) |
| `block: ["chmod -R"]` | `block: [{binary: chmod, flags: [recursive]}]` |
| `block: [bash, sudo]` | `block: [{binary: bash}, {binary: sudo}]` |

### Known limitation

Short flags that take a separated value (`grep -e pattern file`) leave the value in `positional` because we don't know which short flags consume a value without per-binary knowledge. The default policy doesn't rely on this, but if you're writing custom rules, prefer long-flag forms (`--pattern=regex`) which are parsed cleanly.

## Modes

- `observe` — log everything, block nothing. Use this until you trust your tuning.
- `enforce` — actions are applied. Confirms gate execution until you respond.

## Validation

```
parry validate
```

Run after every edit. Parry refuses to load a malformed policy. Common errors:

- `rule for rm references unknown flag "destroy"` — the semantic flag name isn't defined under `flag_equivalents.rm`. Add it, or fix the typo in the rule.
- `entry missing binary` — every rule entry needs a `binary:` field.
- `flag_equivalents.rm.recursive has no forms` — an equivalents list must have at least one form.
