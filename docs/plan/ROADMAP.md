# Roadmap

> Phase 1 is the core. Phase 2 adds observability. Phase 3 adds ML detection. Each phase is independently useful.

## Phase 1 — "The Wall"

**Goal:** Proxy mode + check mode + policy engine.

### Core proxy + check mode
- [ ] Go project scaffold — cobra CLI, CI, test harness with mock MCP server
- [ ] MCP stdio proxy — wrap child MCP server, forward JSON-RPC, log to SQLite
- [ ] `parry check` command — read tool call JSON on stdin, evaluate policy, return exit code
- [ ] Version policy YAML + SQLite schema with migrations

### Policy engine
- [ ] YAML parser + hot-reload (fsnotify watch, atomic swap — no partial policy states)
- [ ] T1–T5 blast-radius classifier
- [ ] Allow / Block / Confirm rule engine
- [ ] `parry validate` — check policy YAML for syntax errors, unknown fields, invalid tier refs
- [ ] Default policy — email, shell, filesystem rules out of box

### Rate limiter + observe mode
- [ ] Sliding window rate limiter — per-tool, per-scope
- [ ] Observe mode + `parry report` — summary of hypothetical blocks
- [ ] `parry wrap` command — one-command proxy setup
- [ ] Claude Code integration guide — exact `.claude/settings.json` for `parry check`

### Alpha release
- [ ] README + quickstart docs — separate guides for proxy mode + Claude Code
- [ ] Demo GIF/recording — 30-second clip showing Parry blocking a rogue tool call
- [ ] Real-world test — run against real MCP agents + real Claude Code
- [ ] CI badge, `go test ./...` passes clean

**Milestone: v0.1 ALPHA**

---

## Phase 2 — "The Eyes"

**Goal:** Observability + human-in-the-loop. Approve from your phone.

### Telegram bot
- [ ] `parry telegram setup` — guided BotFather setup
- [ ] Confirmation flow — pause → Telegram → approve/deny
- [ ] Kill switch — `/stop` halts all agent activity

### Web dashboard
- [ ] React dashboard embedded in binary — timeline, stats, policy status
- [ ] REST API for dashboard + external tools

### Digests + multi-server
- [ ] Daily digest via Telegram
- [ ] Multi-MCP-server support — wrap multiple servers through one Parry instance
- [ ] HTTP proxy mode for remote MCP servers

### Beta release
- [ ] Homebrew + Docker + install script
- [ ] Tokenizer validation — go-sentencepiece vs Python reference
- [ ] Cursor integration guide

**Milestone: v0.2 BETA**

---

## Phase 3 — "The Brain"

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
