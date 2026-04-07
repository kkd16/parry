# Writing a Parry Policy

> Placeholder. Full reference coming soon.

Parry's policy file lives at `~/.parry/policy.yaml`. It controls which tool calls are allowed, which prompt for confirmation, and which are blocked outright.

## Quick reference

```yaml
version: 1
mode: observe          # observe | enforce
check_mode_confirm: block   # what "confirm" means when no notifier is wired up
default_action: confirm     # fallback for unmatched tools

protected_paths:       # off limits to every tool, regardless of action
  - "~/.ssh/*"
  - ".env"

rules:
  shell:
    default_action: confirm
    allow:   [ls, cat, "git status"]
    confirm: [rm, curl, "git push"]
    block:   [sudo]
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
- **Shell entries**: bare binary names (`rm`) or `binary subcommand` pairs (`git push`). Compound commands resolve to the highest tier among the binaries they invoke.
- **Protected paths**: enforced across every rule. A `cat ~/.ssh/id_rsa` is blocked even though `cat` is allowed.
- **Rate limit**: per-session, per-tool sliding window. Exceeding it blocks further calls until the window rolls.

## Modes

- `observe` — log everything, block nothing. Use this until you trust your tuning.
- `enforce` — actions are applied. Confirms gate execution until you respond.

## Validation

```
parry validate
```

Run after every edit. Parry refuses to load a malformed policy.

---

This doc is a placeholder. The full policy reference, including notifier setup and the canonical tool table, will land here.
