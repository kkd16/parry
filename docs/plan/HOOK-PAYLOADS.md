# Hook Payloads

Real payloads captured from tool hooks. Reference for building parsers.

## Cursor

### beforeShellExecution

Captured 2026-03-11, Cursor 2026.03.11-6dfa30c.

**Input (stdin):**

```json
{
  "conversation_id": "abc-123",
  "generation_id": "abc-123",
  "model": "claude-4.6-opus-high-thinking",
  "command": "cat /tmp/cursor-hook-input.json",
  "cwd": "",
  "sandbox": false,
  "hook_event_name": "beforeShellExecution",
  "cursor_version": "2026.03.11-6dfa30c",
  "workspace_roots": ["/home/user/project"],
  "user_email": "user@example.com",
  "transcript_path": "/home/user/.cursor/projects/project/agent-transcripts/abc-123/abc-123.jsonl"
}
```

**Response (stdout):**

```json
{"permission": "allow"}
```

```json
{"permission": "deny", "user_message": "Blocked by Parry", "agent_message": "This command was blocked because ..."}
```

## Claude Code

*Not yet captured.*

## GitHub Copilot

*Not yet captured.*
