# Parry

**Your agent decides. Parry enforces.**

Runtime security for AI agents and coding tools. One binary. Two modes. Every framework.

---

Parry is a security layer that sits **outside** your AI agent. It intercepts every tool call (shell commands, file edits, API requests, emails), classifies it by blast radius, and enforces your rules. It can't be prompt-injected or turned off by a confused model.

## Why

AI agents run shell commands, send emails, edit files, and hit APIs on your behalf. When they go wrong (prompt injection, context drift, misconfiguration), the consequences are real.

Most security tools today run *inside* the agent as natural-language instructions. A prompt injection can override those. Your security skill gets talked out of protecting you.

Parry runs out-of-process. Deterministic rules. The agent doesn't know it's there.

## Two Modes

**Proxy Mode** sits between any MCP agent and its tool servers. Intercepts all JSON-RPC traffic.

```bash
parry wrap npx @gmail/mcp-server
```

**Check Mode** reads a tool call on stdin and returns allow/block via exit code. Works with Claude Code hooks, Cursor hooks, Copilot hooks, or anything with pre-execution checks. If Parry crashes, the non-zero exit code blocks the action (fail-closed).

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

| Tool | Mode | Setup |
|------|------|-------|
| Claude Code | Check | `PreToolUse` hook in `.claude/settings.json` |
| Cursor AI | Check | `beforeShellExecution` / `beforeMCPExecution` in `.cursor/hooks.json` |
| GitHub Copilot | Check | `.github/hooks` `preToolUse` |
| Any MCP agent | Proxy | `parry wrap <server command>` |
| Any tool with pre-exec hooks | Check | Pipe JSON to stdin, read exit code |

### Claude Code

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "",
      "hooks": [{ "type": "command", "command": "parry check" }]
    }]
  }
}
```

### Cursor

```json
{
  "hooks": {
    "beforeShellExecution": { "command": "parry check" },
    "beforeMCPExecution": { "command": "parry check" }
  }
}
```

## Onboarding

1. **Install + Observe**. `parry init` runs in observe mode. Logs everything, blocks nothing.
2. **Review Report**. `parry report` shows what would have been blocked.
3. **Tune Policy**. Adjust thresholds, add allow-lists, change tier assignments.
4. **Enforce**. Set `mode: enforce` and Parry actively protects.

## Design Principles

1. **ML signals, rules enforce.** The ONNX scanner gives probabilities. The policy engine makes binary decisions. No LLM in the enforcement path.
2. **Observe before enforce.** New installs start in observe mode. Build trust with data.
3. **Classify by consequence.** The blast-radius tiers classify by what happens if it goes wrong, not what the action is called.
4. **External enforcement.** Out-of-process. The agent can't override it.
5. **Local-first.** All data, models, and enforcement stay on your machine. Nothing leaves.
6. **Fail closed.** If Parry crashes, tool calls are blocked. Non-zero exit in check mode, proxy-down in proxy mode.

## Tech Stack

| Component | Choice |
|-----------|--------|
| Language | Go 1.26+, single binary, ~15MB core |
| MCP SDK | `modelcontextprotocol/go-sdk` |
| Database | `modernc.org/sqlite`, pure Go, no CGO |
| Policy | YAML (`go.yaml.in/yaml/v4`) + `fsnotify` hot-reload |
| CLI | `alecthomas/kong` |
| Scanner | `yalue/onnxruntime_go` + DeBERTa-v3-base (~5ms inference). ONNX Runtime + model downloaded by `parry init`. |
| Notifications | Telegram via `go-telegram/bot` |
| Dashboard | React (Vite) embedded in binary via `embed` |

## Distribution

```bash
go install github.com/kkd16/parry@latest    # go install
brew install parry                           # homebrew (planned)
docker run ghcr.io/kkd16/parry               # docker
```

macOS (ARM + Intel) + Linux (AMD64 + ARM64). Windows via WSL2.

## License

[Apache 2.0](LICENSE)
