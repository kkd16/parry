# Integration Modes

Both modes use the same policy engine, scanner, and blast-radius classifier. The difference is the entry point.

## Mode 1: MCP Proxy

Parry acts as a man-in-the-middle: presents itself as an MCP server to the agent and as a client to the real tool servers. The agent never knows Parry is there.

### Stdio Wrapper (Primary)

```bash
parry wrap npx @gmail/mcp-server

# In agent config, point to Parry instead of the real server
command: "parry"
args: ["wrap", "npx", "@gmail/mcp-server"]
```

### HTTP Reverse Proxy (Remote Servers)

```bash
parry wrap --mode http --listen :9091 --upstream https://mcp.service.com/sse
```

### Proxy Capabilities

- Full MCP `tools/call` interception
- Policy enforcement (allow / block / confirm)
- T1–T5 blast-radius classification
- Sliding-window rate limiting (per-session)
- ONNX content scanning on tool results
- Telegram confirmations (pause → approve/deny, timeout → block)
- Kill switch (halt all forwarding)
- Full audit log + observe mode

## Mode 2: CLI Check

`parry check` reads a tool call as JSON on stdin, evaluates policy, and exits:

- **Exit 0** — allow
- **Exit 2** — block
- **Any other non-zero exit** — treated as block (fail-closed)

This means if Parry crashes (segfault, panic, OOM), the non-zero exit code causes the calling tool to block the action. Fail-closed by default.

### Claude Code (PreToolUse Hook)

```json
// .claude/settings.json or ~/.claude/settings.json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "",
      "hooks": [{ "type": "command", "command": "parry check" }]
    }]
  }
}
```

Claude Code passes tool call JSON on stdin. Exit 0 = proceed, exit 2 = block (stderr message shown to the model).

### Cursor AI

```json
// .cursor/hooks.json
{
  "hooks": {
    "beforeShellExecution": { "command": "parry check" },
    "beforeMCPExecution": { "command": "parry check" }
  }
}
```

### GitHub Copilot

```json
// .github/hooks/security.json
{ "preToolUse": { "command": "parry check" } }
```

### Generic

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf /"}}' | parry check
echo $?  # → 2 (blocked)
```

### Check Capabilities

- All hooked tool call interception
- Policy enforcement (allow / block — confirm falls back to `check_mode_confirm` policy, default: block)
- T1–T5 blast-radius classification
- Stateful rate limiting via SQLite (per-session, derived from cwd)
- ONNX content scanning on tool inputs
- Full audit log + observe mode

### What Check Mode Does NOT Cover

- **No Telegram confirmations** — synchronous allow/block only. Policy rules that say `confirm` fall back to `check_mode_confirm` setting (default: `block`).
- **No kill switch** — per-call only, no persistent connection.
- **No tool result scanning** — check mode runs before execution, so it can only scan tool inputs, not outputs. Prompt injections embedded in files read by the agent are not caught in check mode. The ONNX scanner in proxy mode can scan tool results.

## Capability Comparison

| Capability | Proxy | Check |
|-----------|-------|-------|
| Intercept tool calls | All MCP `tools/call` | All hooked events |
| Policy enforcement | Same engine | Same engine |
| Blast-radius classification | T1–T5 | T1–T5 |
| Rate limiting | Sliding window (per-session) | Stateful via SQLite (per-session) |
| ONNX scanning | Tool inputs + results | Tool inputs only |
| Telegram confirmations | Yes (timeout → block) | No (confirm → block by default) |
| Kill switch | Yes | No |
| Audit log | Yes | Yes |
| Observe mode | Yes | Yes |
| Fail-closed on crash | Yes (proxy down = no forwarding) | Yes (non-zero exit = block) |

## Check Mode Input Format

Each tool passes a different JSON shape on stdin. Parry normalizes all of them to an internal `{tool_name, tool_input}` representation. Supported input formats:

| Tool | stdin format | Notes |
|------|-------------|-------|
| Claude Code | `{"tool_name": "Bash", "tool_input": {"command": "..."}}` | Also includes `tool_use_id`, `session_id` |
| Cursor | `{"hook": "beforeShellExecution", "command": "...", "cwd": "..."}` | Different shape per hook event |
| GitHub Copilot | `{"tool": "bash", "input": {"command": "..."}}` | Copilot agent format |
| Generic | `{"tool_name": "...", "tool_input": {...}}` | Fallback: Parry's canonical format |

Parry auto-detects the format based on field presence. If the input doesn't match any known format, it's treated as the generic format. If parsing fails entirely, the action is **blocked** (fail-closed).

## Tool Name Normalization

MCP tools use server-scoped names (`gmail.delete`). Claude Code/Cursor use native names (`Bash`, `Edit`, `Read`). Parry normalizes at the interception layer so one policy covers both.

---

*Update as new integrations are added or hook formats change.*
