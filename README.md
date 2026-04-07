# Parry

**Your agent decides. Parry enforces.**

Runtime security for AI agents and coding tools. One binary. Policy-driven enforcement.

---

Parry sits **outside** your AI agent. It reads tool-call payloads from stdin, classifies the action by blast radius, and returns allow/block as a small, deterministic decision. It’s designed to be hard to “talk out of” via prompt injection.

## Why

AI agents run shell commands, send emails, edit files, and hit APIs on your behalf. When they go wrong (prompt injection, context drift, misconfiguration), the consequences are real.

Many security tools today run inside the agent as natural-language instructions. A prompt injection can override those. Your security skill gets talked out of protecting you.

Parry runs out-of-process. Deterministic rules. The agent doesn't know it's there.

## Install

```bash
brew install kkd16/tap/parry
```

Or with Go:

```bash
go install github.com/kkd16/parry@latest
```

## How it works (check mode)

Parry reads a tool call on stdin and returns allow/block (and an optional message) via stdout + exit code. If Parry crashes, a non-zero exit code blocks the action (fail-closed).

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf /"}}' | parry check
# exit code 2 → blocked
```

## Actions: allow / confirm / block

Every tool call resolves to one of three actions:

- **allow** — run silently, log the event.
- **confirm** — pause and prompt via a notifier; falls back to `check_mode_confirm` (default: `block`) when no notifier is configured.
- **block** — refuse and log.

Unmatched tools fall back to `default_action` (default: `confirm`).

## Policy

```yaml
# ~/.parry/policy.yaml
version: 1
mode: observe  # observe | enforce

# In check mode (synchronous), "confirm" rules fall back to this.
# block = fail-closed (default). allow = trust and permit.
check_mode_confirm: block

default_action: confirm

rules:
  shell:
    default_action: confirm
    allow:   [ls, cat, grep, "git status", "git log", cp, mv, "git add", "git commit"]
    confirm: [rm, chmod, curl, wget, "git push"]
    block:   [sudo, su, doas]
  file_edit:
    default_action: allow
  file_read:
    default_action: allow

rate_limit:
  window: 3m
  max: 50
```

## Integrations

Parry ships a setup command for supported agents.

### Cursor

```bash
parry init
parry setup cursor
```

### Claude Code

```bash
parry init
parry setup claude
```

## Typical flow

1. **Initialize**. `parry init` creates `~/.parry/policy.yaml` (defaults to observe).
2. **Install hooks**. `parry setup cursor` or `parry setup claude`.
3. **Review**. Use `parry dashboard` to see what’s happening.
4. **Enforce**. Set `mode: enforce` in the policy when you’re ready.

## Design Principles

1. **Deterministic enforcement.** The policy engine makes binary decisions. No LLM in the enforcement path.
2. **Observe before enforce.** New installs start in observe mode. Build trust with data.
3. **Classify by consequence.** Policies are written in terms of what happens if a call goes wrong, not what the tool is called.
4. **External enforcement.** Out-of-process. The agent can't override it.
5. **Local-first.** All data, models, and enforcement stay on your machine. Nothing leaves.
6. **Fail closed.** If Parry crashes, tool calls are blocked via a non-zero exit code.

## Development

```bash
make build        # build the binary
make lint         # run golangci-lint
make lint-fix     # run golangci-lint with auto-fix
make test         # run tests with race detector
```

## Contributing

- Keep changes focused and easy to review.
- Vibe coded contributions welcome. 

## License

[Apache 2.0](LICENSE)
