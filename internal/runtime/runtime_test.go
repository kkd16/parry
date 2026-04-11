package runtime

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/kkd16/parry/internal/check"
	"github.com/kkd16/parry/internal/policy"
	"github.com/kkd16/parry/internal/store"
	"github.com/stretchr/testify/require"
	"go.uber.org/mock/gomock"
)

func decideShell(t *testing.T, eng *Engine, cmd string) Verdict {
	t.Helper()
	tc := &check.ToolCall{
		Tool:      check.ToolShell,
		RawName:   "Bash",
		ToolInput: map[string]any{"command": cmd},
	}
	return eng.Decide(context.Background(), tc)
}

func TestDecide_AllowPath(t *testing.T) {
	pinCwd(t)
	dbPath := tempDB(t)
	eng := New(loadEngine(t, shellRuleYAML("enforce", "allow", "ls")), dbPath)

	got := decideShell(t, eng, "ls")
	require.Equal(t, Verdict{Action: "allow", Respond: "allow"}, got)

	rows := listAllEvents(t, dbPath)
	require.Len(t, rows, 1)
	require.Equal(t, "allow", rows[0].Action)
}

func TestDecide_BlockPath(t *testing.T) {
	pinCwd(t)
	dbPath := tempDB(t)
	eng := New(loadEngine(t, shellRuleYAML("enforce", "block", "rm")), dbPath)

	got := decideShell(t, eng, "rm /tmp/x")
	require.Equal(t, Verdict{Action: "block", Respond: "deny", Message: "Blocked by Parry"}, got)

	rows := listAllEvents(t, dbPath)
	require.Len(t, rows, 1)
	require.Equal(t, "block", rows[0].Action)
}

func TestDecide_ObserveMode(t *testing.T) {
	pinCwd(t)
	dbPath := tempDB(t)
	eng := New(loadEngine(t, shellRuleYAML("observe", "block", "rm")), dbPath)

	got := decideShell(t, eng, "rm /tmp/x")
	require.Equal(t, Verdict{Action: "observe", Respond: "allow"}, got)

	rows := listAllEvents(t, dbPath)
	require.Len(t, rows, 1)
	require.Equal(t, "observe", rows[0].Action)
}

func TestDecide_ConfirmFallback_NoNotifications(t *testing.T) {
	pinCwd(t)
	dbPath := tempDB(t)
	yamlDoc := `version: 1
mode: enforce
check_mode_confirm: block
default_action: confirm
rules:
  shell:
    default_action: confirm
`
	eng := New(loadEngine(t, yamlDoc), dbPath)

	got := decideShell(t, eng, "whoami")
	require.Equal(t, Verdict{Action: "block", Respond: "deny", Message: "Blocked by Parry"}, got)

	rows := listAllEvents(t, dbPath)
	require.Len(t, rows, 1)
	require.Equal(t, "block", rows[0].Action)
}

func TestDecide_ConfirmViaNotify_Approved(t *testing.T) {
	pinCwd(t)
	name, mc := newMockConfirmer(t)
	mc.EXPECT().Confirm(gomock.Any(), gomock.Any()).Return(true, nil)

	dbPath := tempDB(t)
	yamlDoc := `version: 1
mode: enforce
check_mode_confirm: block
default_action: confirm
rules:
  shell:
    default_action: confirm
notifications:
  provider: ` + name + `
  confirmation_timeout: 5s
`
	eng := New(loadEngine(t, yamlDoc), dbPath)

	got := decideShell(t, eng, "whoami")
	require.Equal(t, Verdict{Action: "allow", Respond: "allow"}, got)

	rows := listAllEvents(t, dbPath)
	require.Len(t, rows, 1)
	require.Equal(t, "allow", rows[0].Action)
}

const rateLimitAllowLsYAML = `version: 1
mode: enforce
check_mode_confirm: block
default_action: confirm
rules:
  shell:
    default_action: confirm
    allow:
      - binary: ls
rate_limit:
  window: 1m
  max: 3
  on_exceed: block
`

func TestDecide_RateLimitTriggers(t *testing.T) {
	pinCwd(t)
	dbPath := tempDB(t)

	seedStore := openStoreAt(t, dbPath)
	seedRateLimitEvents(t, seedStore, 3, store.Session())

	eng := New(loadEngine(t, rateLimitAllowLsYAML), dbPath)
	got := decideShell(t, eng, "ls")
	require.Equal(t, "block", got.Action)
	require.Equal(t, "deny", got.Respond)
	require.Contains(t, got.Message, "Rate limit exceeded")

	rows := listAllEvents(t, dbPath)
	require.Len(t, rows, 4)
	require.Equal(t, "block", rows[0].Action)
}

func TestDecide_NoPolicyLoaded(t *testing.T) {
	pinCwd(t)
	dbPath := tempDB(t)
	eng := New(policy.NewEngine(), dbPath)

	got := decideShell(t, eng, "ls")
	require.Equal(t, "block", got.Action)
	require.Equal(t, "deny", got.Respond)
	require.Contains(t, got.Message, "no policy loaded")

	require.NoFileExists(t, dbPath)
}

func TestDecide_DBOpenFailure(t *testing.T) {
	pinCwd(t)
	badPath := filepath.Join(t.TempDir(), "missing-subdir", "x.db")
	eng := New(loadEngine(t, shellRuleYAML("enforce", "allow", "ls")), badPath)

	got := decideShell(t, eng, "ls")
	require.Equal(t, Verdict{Action: "allow", Respond: "allow"}, got)
}

const rateLimitObserveLsYAML = `version: 1
mode: observe
check_mode_confirm: block
default_action: confirm
rules:
  shell:
    default_action: confirm
    allow:
      - binary: ls
rate_limit:
  window: 1m
  max: 3
  on_exceed: block
`

func TestDecide_RateLimitSkippedInObserveMode(t *testing.T) {
	pinCwd(t)
	dbPath := tempDB(t)

	seedStore := openStoreAt(t, dbPath)
	seedRateLimitEvents(t, seedStore, 10, store.Session())

	eng := New(loadEngine(t, rateLimitObserveLsYAML), dbPath)
	got := decideShell(t, eng, "ls")
	require.Equal(t, Verdict{Action: "observe", Respond: "allow"}, got)
}
