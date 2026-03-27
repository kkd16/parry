# Parry

**Your agent decides. Parry enforces.**

Runtime security for AI agents and coding tools. One binary. Policy-driven enforcement.

---

Parry sits **outside** your AI agent. It reads tool-call payloads from stdin, classifies the action by blast radius, and returns allow/block as a small, deterministic decision. It’s designed to be hard to “talk out of” via prompt injection.

## Why

AI agents run shell commands, send emails, edit files, and hit APIs on your behalf. When they go wrong (prompt injection, context drift, misconfiguration), the consequences are real.

Most security tools today run *inside* the agent as natural-language instructions. A prompt injection can override those. Your security skill gets talked out of protecting you.

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

## Blast-Radius Classification (T1-T5)

| Tier | Name | Examples | Default |
|------|------|----------|---------|
| T1 | Observe | `file.list`, `git.status` | Allow silently |
| T2 | Local Write | `file.write`, `git.branch` | Allow + log |
| T3 | Destructive | `file.delete`, `rm -rf` | Confirm above threshold |
| T4 | External Comms | `gmail.send`, `slack.post`, `git.push` | Confirm if external |
| T5 | Credential/System | `sudo`, `oauth.token`, `ssh` | Block by default |

Unknown tools default to T3 (configurable via `default_tier`).

## Policy

```yaml
# ~/.parry/policy.yaml
version: 1
mode: observe  # observe | enforce

# In check mode (synchronous), "confirm" rules fall back to this.
# block = fail-closed (default). allow = trust and permit.
check_mode_confirm: block

tiers:
  T1_observe:     allow
  T2_local_write: allow
  T3_destructive: confirm
  T4_external:    confirm
  T5_credential:  block

rules:
  gmail.delete:   { tier: T3 }
  gmail.send:     { tier: T4, block_when: { recipients_count: "> 10" } }
  Bash:           { tier: T3, allow_list: ["git *", "npm *", "ls *"],
                   block_list: ["rm -rf *", "sudo *", "curl * | sh"] }
  Edit:           { tier: T2, block_when: { path_matches: ["/etc/*", "~/.ssh/*"] } }

rate_limits:
  - { scope: "gmail.*",     max: 50, window: "5m", on_exceed: block_and_alert }
  - { scope: "gmail.delete", max: 5, window: "1m", on_exceed: confirm }
  - { scope: "Bash",        max: 10, window: "1m", on_exceed: block_and_alert }
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
3. **Review**. Use `parry report` and `parry dashboard` to see what’s happening.
4. **Enforce**. Set `mode: enforce` in the policy when you’re ready.

## Design Principles

1. **Deterministic enforcement.** The policy engine makes binary decisions. No LLM in the enforcement path.
2. **Observe before enforce.** New installs start in observe mode. Build trust with data.
3. **Classify by consequence.** The blast-radius tiers classify by what happens if it goes wrong, not what the action is called.
4. **External enforcement.** Out-of-process. The agent can't override it.
5. **Local-first.** All data, models, and enforcement stay on your machine. Nothing leaves.
6. **Fail closed.** If Parry crashes, tool calls are blocked via a non-zero exit code.

## Tech Stack

| Component | Choice |
|-----------|--------|
| Language | Go 1.26+, single binary, ~15MB core |
| Database | `modernc.org/sqlite`, pure Go, no CGO |
| Policy | YAML (`go.yaml.in/yaml/v4`) |
| CLI | `alecthomas/kong` |
| Dashboard | React (Vite) embedded in binary via `embed` |

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
