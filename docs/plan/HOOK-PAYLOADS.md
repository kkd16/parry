# Hook Payloads

Real payloads captured from tool hooks. Reference for building parsers.

## Cursor

### preToolUse

Cursor fires `preToolUse` before any tool execution (shell, file read, file write, MCP, etc.).

**Input (stdin):**

```json
{
  "conversation_id": "abc-123",
  "generation_id": "abc-123",
  "model": "claude-4.6-opus-high-thinking",
  "tool_name": "Shell",
  "tool_input": {
    "command": "npm test",
    "working_directory": "/home/user/project"
  },
  "tool_use_id": "abc123",
  "cwd": "/home/user/project",
  "hook_event_name": "preToolUse",
  "cursor_version": "2026.03.11-6dfa30c",
  "workspace_roots": ["/home/user/project"],
  "user_email": "user@example.com",
  "transcript_path": "/home/user/.cursor/projects/project/agent-transcripts/abc-123/abc-123.jsonl"
}
```

Tool names: `Shell`, `Read`, `Write`, `Grep`, `Delete`, `Task`, and MCP tools.

**Response (stdout):**

```json
{"permission": "allow"}
```

```json
{"permission": "deny", "user_message": "Blocked by Parry"}
```

## Claude Code

### PreToolUse

Researched 2026-03-22 from Claude Code hooks documentation.

**Input (stdin):**

```json
{
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": {
    "command": "npm test",
    "description": "Run tests",
    "timeout": 120000
  },
  "session_id": "abc123",
  "transcript_path": "/Users/user/.claude/projects/project/transcript.jsonl",
  "cwd": "/Users/user/project",
  "permission_mode": "default",
  "tool_use_id": "toolu_01ABC123",
  "agent_id": "unique-subagent-id",
  "agent_type": "Explore"
}
```

Tool names: `Bash`, `Write`, `Edit`, `Read`, `Glob`, `Grep`, `Agent`, `WebSearch`, `WebFetch`, `NotebookEdit`, plus MCP tool names.

Tool input varies by tool:
- **Bash**: `{"command": "...", "description": "...", "timeout": 120000}`
- **Write**: `{"file_path": "/path/to/file", "content": "..."}`
- **Edit**: `{"file_path": "/path/to/file", "old_string": "...", "new_string": "..."}`
- **Read**: `{"file_path": "/path/to/file", "offset": 10, "limit": 50}`
- **Glob**: `{"pattern": "*.js", "path": "/path/to/search"}`
- **Grep**: `{"pattern": "regex", "path": "/path/to/search"}`

**Response (stdout):**

```json
{"decision": "allow"}
```

```json
{"decision": "block", "reason": "Blocked by Parry: tier 5 command"}
```

Exit codes: 0 = success (parse stdout JSON), 2 = blocking error (stderr becomes error message).

## GitHub Copilot

*Not yet captured.*
