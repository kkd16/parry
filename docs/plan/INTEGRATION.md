# Integration

## Setup

```bash
# Install
go install github.com/kkd16/parry@latest

# Initialize — creates ~/.parry/ and copies default policy
parry init

# Verify
parry version
```

## Cursor

Parry hooks into Cursor via `preToolUse`, which fires before any tool execution (shell, file read, file write, MCP, etc.). Cursor pipes a JSON payload to stdin, Parry normalizes the tool name, evaluates against policy, and responds with JSON on stdout.

### Hook configuration

Project-level (`.cursor/hooks.json`) or global (`~/.cursor/hooks.json`):

```json
{
  "version": 1,
  "hooks": {
    "preToolUse": [
      { "command": "parry check", "failClosed": true }
    ]
  }
}
```

Or run `parry setup cursor` to install automatically.

### Important: `failClosed: true`

Cursor is **fail-open by default** — if Parry crashes, the command goes through. Setting `failClosed: true` flips this so any non-zero exit blocks the action. Without this flag, Parry's fail-closed guarantee does not hold.

### Tool name mapping

| Cursor tool | Parry canonical |
|-------------|-----------------|
| `Shell`     | `shell`         |
| `Read`      | `file_read`     |
| `Write`     | `file_edit`     |
| `Grep`      | `file_read`     |
| `Delete`    | `file_edit`     |

Unknown tools are classified as `unknown`.

### Response format

```json
{"permission": "allow"}
```

```json
{"permission": "deny", "user_message": "Blocked by Parry"}
```

### Exit codes

- `0` — success, use JSON output
- `2` — block (equivalent to `permission: "deny"`)
- Other non-zero — with `failClosed: true`, blocks the action

## Claude Code

Parry hooks into Claude Code via `PreToolUse`, which fires before any tool execution. Claude Code pipes a JSON payload to stdin, Parry normalizes the tool name, evaluates against policy, and responds with JSON on stdout.

### Hook configuration

Global (`~/.claude/settings.json`) or project (`.claude/settings.json`):

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "",
        "hooks": [
          { "type": "command", "command": "parry check" }
        ]
      }
    ]
  }
}
```

Or run `parry setup claude` to install automatically.

### Tool name mapping

| Claude Code tool | Parry canonical |
|------------------|-----------------|
| `Bash`           | `shell`         |
| `Write`          | `file_edit`     |
| `Edit`           | `file_edit`     |
| `Read`           | `file_read`     |
| `Glob`           | `file_read`     |
| `Grep`           | `file_read`     |
| `NotebookEdit`   | `file_edit`     |

Unknown tools (including MCP tools like `mcp__server__tool`) are classified as `unknown`.

### Response format

```json
{"decision": "allow"}
```

```json
{"decision": "block", "reason": "Blocked by Parry: tier 5 command"}
```

### Exit codes

- `0` — success, use JSON output
- `2` — block (stderr becomes error message shown to Claude)

## GitHub Copilot

*Not yet implemented.* See `HOOK-PAYLOADS.md` for expected format.

## MCP Proxy (Phase 2)

*Not yet implemented.* `parry wrap` will proxy MCP servers via stdio or HTTP.

---

*Update as new integrations are added.*
