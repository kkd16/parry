# Lessons

Patterns learned from mistakes. Update this file after any correction from the user. Review at session start.

---

### 1. Scaffold bare-bones first
When asked to scaffold, produce the absolute minimum: types, empty stubs, directory structure. No business logic, no tests, no wiring. Add those incrementally when explicitly asked. Don't front-load implementation under the guise of "scaffolding."

### 2. Phase scope means phase scope
If something is deferred to a later phase, don't include it in the scaffold. No stub files, no CLI commands, no imports for features that belong to a future phase. Keep the codebase honest about what's in scope.

### 3. Update LESSONS.md immediately on correction
When the user corrects you, update this file in the same response as the fix. Don't wait to be asked. The correction is the trigger — not a follow-up reminder.

### 4. Keep docs lean
Don't pad documentation with info that belongs elsewhere (like exit code behavior or general protocol details). Stick to the purpose of the file — if it's a payload reference, just show payloads and responses.

### 5. Don't add tests unless asked
When the user says "stub" or "simple implementation", that means code only — no test files. Only add tests when explicitly requested.

### 6. Configuration belongs in config, not code
Don't hardcode classification tables, lookup maps, or policy data in Go. If users should be able to see and change it, it goes in the YAML config. Code reads the config — it doesn't replace it.

### 7. Keep docs in sync with code changes
When adding, removing, or renaming CLI commands, packages, or project structure, update the planning docs (ARCHITECTURE.md, ROADMAP.md, INTEGRATION.md, etc.) in the same change. Don't let docs drift from reality. This includes updating setup instructions, response formats, and integration guides when the actual behavior changes. Treat docs as part of the PR, not an afterthought.

## Open Concerns

- **Hook coverage:** `beforeShellExecution` only covers shell commands. File edits, MCP calls, etc. go unmonitored. Consider `preToolUse` hook which fires for all tool types — need to capture its payload first.
- **Process-per-check overhead:** Each `parry check` spawns a process and will open/close SQLite. Watch for latency at high command volume.
- **`failClosed: true` is opt-in:** Cursor defaults to fail-open. If someone omits this flag in hooks.json, Parry crashes silently allow everything. Document this prominently.
- **Binary must be on PATH for global hooks:** `./parry check` only works from project root.
- **Protected paths before `parry init`:** `~/.parry/*` is a protected path but the folder doesn't exist until `parry init` is run. Investigate whether this matters — could an agent create `~/.parry/policy.yaml` with a permissive policy before the user runs `parry init`, then Parry would load the attacker's policy?
- **Enforce mode can brick the workflow:** With `failClosed: true` in hooks.json, switching to enforce mode and then deleting or failing to build the binary locks out all shell commands — including the rebuild. Need a safe way to recover (e.g. always allow `go build` for the parry binary, or require the binary to exist before enabling enforce).
