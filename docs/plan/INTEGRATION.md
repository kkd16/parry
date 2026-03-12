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

## Cursor (Current)

Parry hooks into Cursor via `beforeShellExecution`. Cursor pipes a JSON payload to stdin, Parry evaluates it and responds with JSON on stdout.

### Project-level hook

Create `.cursor/hooks.json` in your project root:

```json
{
  "version": 1,
  "hooks": {
    "beforeShellExecution": [
      { "command": "parry check", "failClosed": true }
    ]
  }
}
```

### Global hook

Create `~/.cursor/hooks.json` — applies to all projects:

```json
{
  "version": 1,
  "hooks": {
    "beforeShellExecution": [
      { "command": "parry check", "failClosed": true }
    ]
  }
}
```

### Important: `failClosed: true`

Cursor is **fail-open by default** — if Parry crashes, the command goes through. Setting `failClosed: true` flips this so any non-zero exit blocks the action. Without this flag, Parry's fail-closed guarantee does not hold.

### How it works

1. Agent runs a shell command in Cursor
2. Cursor spawns `parry check` and pipes the hook payload to stdin
3. Parry reads the JSON, evaluates against policy
4. Parry writes `{"permission": "allow"}` or `{"permission": "deny", ...}` to stdout
5. Cursor reads the response and allows or blocks the command

### Response format

```json
{"permission": "allow"}
```

```json
{"permission": "deny", "user_message": "Blocked by Parry", "agent_message": "This command was blocked because ..."}
```

### Exit codes

- `0` — success, use JSON output
- `2` — block (equivalent to `permission: "deny"`)
- Other non-zero — with `failClosed: true`, blocks the action

## Claude Code (Phase 1.5)

*Not yet implemented.* See `HOOK-PAYLOADS.md` for expected format.

## GitHub Copilot (Phase 1.5)

*Not yet implemented.* See `HOOK-PAYLOADS.md` for expected format.

## MCP Proxy (Phase 2)

*Not yet implemented.* `parry wrap` will proxy MCP servers via stdio or HTTP.

---

*Update as new integrations are added.*
