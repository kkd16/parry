# Vision

> Your agent decides. Parry enforces.

## Mission

Parry is the universal security layer for AI tool use. Every agent framework, every coding tool, every MCP connection routes enforcement through Parry.

The bet isn't on any single agent framework surviving. The bet is that **AI tools will keep calling other tools, and someone needs to enforce the rules at that boundary.**

## Design Principles

| # | Principle | Detail |
|---|-----------|--------|
| 1 | ML signals, rules enforce | The ONNX scanner provides probabilities. The policy engine makes binary decisions. No LLM in the enforcement path. |
| 2 | Observe before enforce | New installs run in observe mode. Build trust with data, not promises. |
| 3 | Classify by consequence, not verb | T1–T5 classifies by what happens if the action goes wrong, not what it's called. |
| 4 | External enforcement | Out-of-process. The agent cannot override, ignore, or reason around Parry's decisions. |
| 5 | Local-first, always | All data, models, and enforcement stay on the user's machine. Non-negotiable. Future features like Trust Registry are opt-in and never required for enforcement. |
| 6 | Protocol-native, tool-agnostic | Proxy mode secures MCP. Check mode secures anything with pre-exec hooks. |
| 7 | Fail closed | If Parry crashes, all tool calls are blocked. Silent failure is not an option. |

## Decision Framework

When evaluating any feature, direction, or trade-off, ask:

1. **Does it ship faster?** Speed beats perfection.
2. **Does it stay local-first?** Data leaving the machine weakens the design.
3. **Does it work beyond one tool?** Multi-tool coverage is good. Single-tool lock-in is fragile.
4. **Is it testable and demonstrable?** If you can't show it working in 30 seconds, simplify.

## Target Users

Developers using AI coding tools (Claude Code, Cursor) and personal AI agents. Comfortable with the terminal. Want guardrails without giving up autonomy.

---

*This document evolves. See plan.html for the original product brainstorm.*
