# Architecture

## Blast-Radius Taxonomy (T1–T5)

Every tool call is classified by **consequence** — what happens if it goes wrong.

### T1 — Observe
Read-only. No state changes.
- Examples: `gmail.read`, `file.list`, `git.status`
- Default: Always allow. Log silently.

### T2 — Local Write
State changes within the local environment. Low blast radius.
- Examples: `gmail.draft`, `file.write` (new file), `git.branch`, `git.commit`
- Default: Allow. Log. Rate limit.
- Note: Overwrites to existing files are T2 only inside a VCS working tree (recoverable via git). Overwrites outside VCS are T3.

### T3 — Destructive
Irreversible or hard-to-reverse changes. High blast radius.
- Examples: `gmail.delete`, `file.delete`, `rm -rf`, `file.write` (overwrite outside VCS)
- Default: Confirm above threshold. Block if rate exceeded.

### T4 — External Communication
Sends data to humans or external systems.
- Examples: `gmail.send`, `slack.post`, `curl POST`, `git.push`
- Default: Confirm if external domain or bulk recipients.

### T5 — Credential / Financial / System
Auth, money, or system permissions.
- Examples: `sudo`, `oauth.token`, `payment`, `ssh`
- Default: Always confirm. Block by default. Require sandbox.

**Unknown tools default to T3.** Users can set `default_tier` in policy to override this (e.g. T2 for a trusted workspace).

Users override tier assignments in YAML policy. The ONNX scanner runs independently of tier classification.

## System Layers

### 1. Interception
- **Proxy mode:** MCP stdio/HTTP man-in-the-middle — wraps real tool servers
- **Check mode:** reads tool call JSON on stdin, returns exit code
- All actions logged to SQLite before any forwarding

### 2. Classification
- Map tool name + args to T1–T5 blast-radius tier
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
version: 1
mode: observe       # observe | enforce

# What happens when a rule says "confirm" but we're in check mode (synchronous)?
# block = fail-closed (default, recommended). allow = trust and permit.
check_mode_confirm: block

# Default tier for unknown/unrecognized tools. Default: T3.
default_tier: T3

tiers:
  T1_observe:     allow
  T2_local_write: allow
  T3_destructive: confirm
  T4_external:    confirm
  T5_credential:  block

rules:
  gmail.delete:   { tier: T3 }
  gmail.send:     { tier: T4, block_when: { recipients_count: "> 10" } }
  Bash:           { tier: T3, allow_list: ["git *", "npm *", "ls *", "cat *"],
                    block_list: ["rm -rf *", "sudo *", "curl * | sh"] }
  Edit:           { tier: T2, block_when: { path_matches: ["/etc/*", "~/.ssh/*"] } }
  shell.exec:     { tier: T5, require_sandbox: true }

# Rate limiting is the single mechanism for "too many calls."
# Per-tool, per-session. Applies regardless of tier.
rate_limits:
  - { scope: "gmail.*",  max: 50, window: "5m",  on_exceed: block_and_alert }
  - { scope: "gmail.delete", max: 5, window: "1m", on_exceed: confirm }
  - { scope: "Bash",     max: 10, window: "1m",  on_exceed: block_and_alert }

scanner:
  enabled: true
  model: deberta-v3-base-prompt-injection-v2
  threshold: 0.85

notifications:
  telegram: { enabled: true, confirmation_timeout: "5m", daily_digest: "09:00" }
```

### Shell Command Matching Limitations

The `allow_list` / `block_list` glob patterns for shell commands (e.g. `Bash`) are a **first line of defense, not a complete solution.** Glob matching is trivially bypassable — `rm -rf *` can be rewritten as `find / -delete`, `perl -e 'system("rm -rf /")'`, `bash -c "rm -rf /"`, etc. The real defense layers are:

1. **ONNX scanner** — catches prompt injection attempts that lead to malicious commands
2. **Rate limiting** — bounds the damage even if individual commands slip through
3. **Tier classification** — the blast-radius tier determines the default action regardless of pattern matching
4. **Block lists are deny-known-bad** — they catch the obvious cases. Unknown commands fall through to tier defaults.

Treat glob patterns as a convenience for common cases, not as a security boundary.

### Tool Name Normalization

MCP tools use server-scoped names (e.g. `gmail.delete`). Claude Code/Cursor tools use native names (e.g. `Bash`, `Edit`, `Read`). One policy covers both — Parry normalizes names at the interception layer.

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

## Project Structure

```
parry/
├── cmd/parry/main.go             # CLI: wrap, check, log, report, scan, dashboard
├── internal/
│   ├── proxy/                    # MCP proxy (stdio + HTTP)
│   ├── check/                    # Check mode: stdin JSON → policy → exit code
│   ├── policy/                   # YAML parser, T1–T5 classifier, rule engine, rate limiter
│   ├── scanner/                  # ONNX runtime, tokenizer, injection detection
│   ├── notify/                   # Telegram bot, digest builder
│   ├── store/                    # SQLite, migrations, queries
│   └── dashboard/                # HTTP server, REST API, embedded React
├── web/                          # React dashboard (Vite + Recharts)
├── configs/default-policy.yaml
├── Dockerfile
├── Makefile
└── go.mod
```

## Tech Stack

| Package | Purpose |
|---------|---------|
| Go 1.24+ | Single binary, cross-compile |
| `mark3labs/mcp-go` | MCP SDK for proxy mode (alt: `modelcontextprotocol/go-sdk`) |
| `modernc.org/sqlite` | Audit log + action history — pure Go, no CGO |
| `go.yaml.in/yaml/v4` | Policy YAML parsing |
| `spf13/cobra` | CLI framework |
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
