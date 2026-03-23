# AGENTS.md

Parry is a runtime security enforcement layer for AI agents and coding tools. Single Go binary, two modes (MCP proxy + CLI check), runs outside the agent process. See `README.md` for full product description and `plan.html` for the complete product plan.

## Plan Docs

`docs/plan/` contains living documents for development:

- `VISION.md` — principles, decision framework, target users
- `ARCHITECTURE.md` — system layers, blast-radius tiers, policy format, tech stack, project structure
- `INTEGRATION.md` — proxy mode + check mode specs, per-tool setup, capability comparison
- `ROADMAP.md` — phased milestones with checkboxes
- `LESSONS.md` — patterns learned from mistakes (update after any correction from the user)

## Code Standards

- **Go 1.26+**, `alecthomas/kong` CLI, `modernc.org/sqlite` (pure Go, no CGO), `go.yaml.in/yaml/v4`, `modelcontextprotocol/go-sdk`
- **No unit tests** — skip writing test files for now (temporary)
- Table-driven tests. Wrap errors with context: `fmt.Errorf("doing X: %w", err)`
- Binary is `parry`. Config dir is `~/.parry/`. Policy file is `~/.parry/policy.yaml`.
- Always use up-to-date practices. Never assume existing code is correct — verify before extending a pattern.
- If something becomes simpler by rewriting it, rewrite it. For non-trivial changes, pause and ask "is there a more elegant way?" If a fix feels hacky, step back and implement the clean solution. Skip this for obvious fixes.
- Fix root causes, not symptoms. No temporary fixes. Senior developer standards.

## Workflow

### Planning
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately — don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### Subagents
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One task per subagent for focused execution

### Verification
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests — then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

### Self-Improvement
- After ANY correction from the user: **immediately** update `docs/plan/LESSONS.md` with the pattern — do this in the same response as the fix, not later
- Do not wait to be reminded. The correction itself is the trigger.
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review `LESSONS.md` at session start for the relevant project

## Rules

- **Fail closed** — if Parry crashes, block the tool call. Silent failure is never acceptable.
- **Local-first** — no cloud deps, no phone-home, no telemetry
- **No LLMs in enforcement** — ML provides signals, deterministic rules enforce
- **External only** — enforcement logic never runs inside the agent's trust boundary
- **Single binary** — don't break the distribution model (ONNX model downloads separately on init)
- **Test enforcement code** — this is security software
