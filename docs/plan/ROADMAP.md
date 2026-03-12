# Roadmap

> Each phase is independently useful. Ship and validate each one before moving on.

## Phase 1 — "The Wall"

**Goal:** Check mode + policy engine. Parry protects Cursor via `beforeShellExecution` hooks.

### Core check mode
- [ ] Go project scaffold — kong CLI, CI, test harness
- [ ] `parry check` command — read Cursor hook JSON on stdin, evaluate policy, respond with JSON on stdout
- [ ] Version policy YAML + SQLite schema with migrations

### Policy engine
- [ ] YAML parser + hot-reload (fsnotify watch, atomic swap — no partial policy states)
- [ ] T1–T5 blast-radius classifier
- [ ] Allow / Block / Confirm rule engine (confirm falls back to `check_mode_confirm`)
- [ ] Allow-list / block-list glob matching for shell commands
- [ ] `parry validate` — check policy YAML for syntax errors, unknown fields, invalid tier refs
- [ ] Default policy — shell, filesystem rules out of box

### Rate limiter + observe mode
- [ ] Sliding window rate limiter — per-tool, per-scope, stateful via SQLite
- [ ] Session isolation — derived from cwd, overridable via `PARRY_SESSION`
- [ ] Observe mode + `parry report` — summary of hypothetical blocks

### Alpha release
- [ ] Cursor integration guide — exact `.cursor/hooks.json` for `parry check`
- [ ] Demo GIF/recording — 30-second clip showing Parry blocking a rogue tool call
- [ ] Real-world test — run against real Cursor sessions
- [ ] CI badge, `go test ./...` passes clean

**Milestone: v0.1 ALPHA**

---

## Phase 1.5 — "More Hooks"

**Goal:** Expand check mode to other tools and Cursor hook events.

- [ ] Claude Code support — `PreToolUse` hook in `.claude/settings.json`
- [ ] GitHub Copilot support
- [ ] Cursor `beforeMCPExecution` / `preToolUse` / `afterFileEdit` hooks
- [ ] Input normalization — auto-detect format from each tool
- [ ] Integration guides for each tool

**Milestone: v0.1.5**

---

## Phase 2 — "The Proxy"

**Goal:** MCP proxy mode. Parry intercepts any MCP server via stdio or HTTP.

### MCP proxy
- [ ] MCP stdio proxy — wrap child MCP server, forward JSON-RPC, intercept tools/call
- [ ] `parry wrap` command — one-command proxy setup
- [ ] HTTP reverse proxy for remote MCP servers
- [ ] Multi-MCP-server support — wrap multiple servers through one Parry instance

### Release
- [ ] Cursor integration guide
- [ ] Real-world test — run against real MCP agents

**Milestone: v0.2**

---

## Phase 3 — "The Eyes"

**Goal:** Observability + human-in-the-loop. Approve from your phone.

### Telegram bot
- [ ] `parry telegram setup` — guided BotFather setup
- [ ] Confirmation flow — pause → Telegram → approve/deny
- [ ] Kill switch — `/stop` halts all agent activity
- [ ] Daily digest via Telegram

### Web dashboard
- [ ] React dashboard embedded in binary — timeline, stats, policy status
- [ ] REST API for dashboard + external tools

### Release
- [ ] Homebrew + Docker + install script

**Milestone: v0.3 BETA**

---

## Phase 4 — "The Brain"

**Goal:** ML-powered prompt injection detection.

### ONNX scanner
- [ ] Tokenizer integration — pure Go or Python shim
- [ ] ONNX runtime wrapper — load model, inference, probability
- [ ] `parry scan` — scan string, file, or skill folder

### Runtime scanning
- [ ] Scan MCP tool results for embedded injections
- [ ] Scan Claude Code/Cursor tool inputs
- [ ] Configurable threshold — strict / normal / relaxed

### Skill scanner + red team
- [ ] `parry audit` — scan installed skills, produce risk report
- [ ] Red-team your own product — prompt-inject an agent, verify Parry blocks it
- [ ] Cross-platform testing — macOS ARM, Intel, Linux AMD64, ARM64

### Stable release
- [ ] Anomaly baseline — learn normal behavior, alert on deviations
- [ ] Blog post: "Why in-agent security is broken by design"
- [ ] Cross-platform release binaries (goreleaser)

**Milestone: v1.0 STABLE**

---

## Post-v1.0

### Trust Registry
Community-driven trust scores for MCP servers and agent skills. **Strictly opt-in** — Parry never sends data without explicit user consent. Users can consume trust scores without contributing. `parry trust check @some-skill`. The `npm audit` of the agent world. Trust Registry is advisory only — it feeds into tier classification as a signal but never overrides local policy.

### Parry Challenge
Gamified CTF where people try to bypass Parry. Every attempt feeds threat intelligence.

### Framework Adapters
Deeper integrations with new coding tools and agent frameworks as they emerge. Check mode makes this cheap.

---

*Update checkboxes and notes as milestones are hit.*
