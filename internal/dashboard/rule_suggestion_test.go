package dashboard

import (
	"testing"

	"github.com/kkd16/parry/internal/policy"
	"github.com/kkd16/parry/internal/store"
	"github.com/stretchr/testify/require"
)

func TestSuggestRuleShell(t *testing.T) {
	tests := []struct {
		name        string
		policy      *policy.Policy
		event       *store.EventRow
		action      policy.Action
		duplicate   bool
		contains    []string
		notContains []string
		warning     string
	}{
		{
			name:   "positional from policy entry",
			policy: testPolicy(t),
			event: &store.EventRow{
				ToolName:  "shell",
				Action:    "allow",
				Binary:    "git",
				ToolInput: map[string]any{"command": "git status --short"},
			},
			action:    policy.Allow,
			duplicate: true,
			contains:  []string{`binary: "git"`, `positional: ["status"]`},
		},
		{
			name:   "known semantic flags",
			policy: testPolicy(t),
			event: &store.EventRow{
				ToolName:  "shell",
				Action:    "block",
				Binary:    "rm",
				ToolInput: map[string]any{"command": "rm -rf /tmp/x"},
			},
			action:    policy.Block,
			duplicate: true,
			contains:  []string{`binary: "rm"`, `flags: ["force", "recursive"]`},
		},
		{
			name:   "compound command uses triggering command",
			policy: testPolicy(t),
			event: &store.EventRow{
				ToolName:  "shell",
				Action:    "block",
				Binary:    "git",
				ToolInput: map[string]any{"command": "git status && rm -rf /tmp/x"},
			},
			action:      policy.Allow,
			duplicate:   false,
			contains:    []string{`binary: "rm"`, `flags: ["force", "recursive"]`},
			notContains: []string{`binary: "git"`},
		},
		{
			name: "does not invent unknown flags",
			policy: loadRequiredPolicy(t, `
version: 1
mode: observe
default_action: confirm
check_mode_confirm: block
rules:
  shell:
    default_action: confirm
  file_edit:
    default_action: allow
  file_read:
    default_action: allow
`),
			event: &store.EventRow{
				ToolName:  "shell",
				Action:    "block",
				Binary:    "rm",
				ToolInput: map[string]any{"command": "rm -rf /tmp/x"},
			},
			action:      policy.Block,
			duplicate:   false,
			contains:    []string{`binary: "rm"`},
			notContains: []string{"flags:"},
		},
		{
			name: "broad rule marks specific suggestion covered",
			policy: loadRequiredPolicy(t, `
version: 1
mode: observe
default_action: confirm
check_mode_confirm: block
rules:
  shell:
    default_action: confirm
    flag_equivalents:
      rm:
        recursive: [r, R, --recursive]
        force: [f, --force]
    block:
      - binary: rm
  file_edit:
    default_action: allow
  file_read:
    default_action: allow
`),
			event: &store.EventRow{
				ToolName:  "shell",
				Action:    "block",
				Binary:    "rm",
				ToolInput: map[string]any{"command": "rm -rf /tmp/x"},
			},
			action:    policy.Block,
			duplicate: true,
			contains:  []string{`binary: "rm"`, `flags: ["force", "recursive"]`},
		},
		{
			name: "protected path block suggests protected_paths",
			policy: loadRequiredPolicy(t, `
version: 1
mode: observe
default_action: confirm
check_mode_confirm: block
protected_paths:
  - "/etc/shadow"
rules:
  shell:
    default_action: confirm
  file_edit:
    default_action: allow
  file_read:
    default_action: allow
`),
			event: &store.EventRow{
				ToolName:  "shell",
				Action:    "block",
				Binary:    "cat",
				ToolInput: map[string]any{"command": "cat /etc/shadow"},
			},
			action:      policy.Block,
			duplicate:   true,
			contains:    []string{"protected_paths:", `"/etc/shadow"`},
			notContains: []string{`binary: "cat"`},
			warning:     "protected_paths applies before shell rules",
		},
		{
			name: "protected path allow warns shell rule cannot override",
			policy: loadRequiredPolicy(t, `
version: 1
mode: observe
default_action: confirm
check_mode_confirm: block
protected_paths:
  - "/etc/shadow"
rules:
  shell:
    default_action: confirm
  file_edit:
    default_action: allow
  file_read:
    default_action: allow
`),
			event: &store.EventRow{
				ToolName:  "shell",
				Action:    "block",
				Binary:    "cat",
				ToolInput: map[string]any{"command": "cat /etc/shadow"},
			},
			action:      policy.Allow,
			duplicate:   false,
			contains:    []string{"No shell allow/confirm rule can override protected_paths"},
			notContains: []string{`binary: "cat"`},
			warning:     "protected_paths is evaluated before shell rules",
		},
		{
			name:   "stored binary without command suggests binary rule",
			policy: testPolicy(t),
			event: &store.EventRow{
				ToolName:  "shell",
				Action:    "confirm",
				Binary:    "make",
				ToolInput: map[string]any{},
			},
			action:    policy.Confirm,
			duplicate: true,
			contains:  []string{`binary: "make"`},
		},
		{
			name:   "empty shell event reports missing binary",
			policy: testPolicy(t),
			event: &store.EventRow{
				ToolName:  "shell",
				Action:    "confirm",
				ToolInput: map[string]any{},
			},
			action:      policy.Confirm,
			duplicate:   false,
			contains:    []string{"No shell binary was captured"},
			notContains: []string{"unresolved shell syntax"},
			warning:     "A shell rule needs a binary name",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := suggestRule(tc.event, tc.policy, tc.action)
			require.Equal(t, "shell", got.Tool)
			require.Equal(t, string(tc.action), got.Action)
			require.Equal(t, tc.duplicate, got.Duplicate)
			for _, want := range tc.contains {
				require.Contains(t, got.YAML, want)
			}
			for _, unwanted := range tc.notContains {
				require.NotContains(t, got.YAML, unwanted)
			}
			if tc.warning != "" {
				require.Contains(t, got.Warning, tc.warning)
			}
		})
	}
}

func TestSuggestRuleFile(t *testing.T) {
	tests := []struct {
		name      string
		policy    *policy.Policy
		event     *store.EventRow
		action    policy.Action
		tool      string
		duplicate bool
		contains  []string
		warning   string
	}{
		{
			name:   "block uses protected path",
			policy: testPolicy(t),
			event: &store.EventRow{
				ToolName:  "file_read",
				Action:    "block",
				File:      "/tmp/secret.env",
				ToolInput: map[string]any{"path": "/tmp/secret.env"},
			},
			action:    policy.Block,
			tool:      "file_read",
			duplicate: false,
			contains:  []string{"protected_paths:", `"/tmp/secret.env"`},
			warning:   "applies across",
		},
		{
			name:   "block uses glob",
			policy: testPolicy(t),
			event: &store.EventRow{
				ToolName:  "file_read",
				Action:    "block",
				ToolInput: map[string]any{"glob": "/tmp/*.env"},
			},
			action:    policy.Block,
			tool:      "file_read",
			duplicate: false,
			contains:  []string{"protected_paths:", `"/tmp/*.env"`},
			warning:   "applies across",
		},
		{
			name: "duplicate uses protected-path coverage",
			policy: loadRequiredPolicy(t, `
version: 1
mode: observe
default_action: confirm
check_mode_confirm: block
protected_paths:
  - "/tmp/*"
rules:
  shell:
    default_action: confirm
  file_edit:
    default_action: allow
  file_read:
    default_action: allow
`),
			event: &store.EventRow{
				ToolName:  "file_read",
				Action:    "block",
				ToolInput: map[string]any{"path": "/tmp/nested/secret.env"},
			},
			action:    policy.Block,
			tool:      "file_read",
			duplicate: true,
			contains:  []string{"protected_paths:", `"/tmp/nested/secret.env"`},
			warning:   "applies across",
		},
		{
			name:   "allow warns broad default",
			policy: testPolicy(t),
			event: &store.EventRow{
				ToolName:  "file_edit",
				Action:    "confirm",
				File:      "/tmp/x.go",
				ToolInput: map[string]any{"path": "/tmp/x.go"},
			},
			action:    policy.Allow,
			tool:      "file_edit",
			duplicate: true,
			contains:  []string{"file_edit:", "default_action: allow"},
			warning:   "applies to every file_edit",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := suggestRule(tc.event, tc.policy, tc.action)
			require.Equal(t, tc.tool, got.Tool)
			require.Equal(t, string(tc.action), got.Action)
			require.Equal(t, tc.duplicate, got.Duplicate)
			for _, want := range tc.contains {
				require.Contains(t, got.YAML, want)
			}
			require.Contains(t, got.Warning, tc.warning)
		})
	}
}

func TestHandleRuleSuggestionErrors(t *testing.T) {
	srv := newTestServer(t)

	rec, _ := doJSON(t, srv.routes(), "GET", "/api/rule-suggestion?action=allow")
	require.Equal(t, 400, rec.Code)

	rec, _ = doJSON(t, srv.routes(), "GET", "/api/rule-suggestion?event_id=1&action=observe")
	require.Equal(t, 400, rec.Code)

	rec, _ = doJSON(t, srv.routes(), "GET", "/api/rule-suggestion?event_id=99&action=allow")
	require.Equal(t, 404, rec.Code)
}

func testPolicy(t *testing.T) *policy.Policy {
	t.Helper()
	p, err := loadTestPolicy()
	require.NoError(t, err)
	return p
}

func loadRequiredPolicy(t *testing.T, yaml string) *policy.Policy {
	t.Helper()
	p, err := loadPolicyFromYAML(t, yaml)
	require.NoError(t, err)
	return p
}

func loadPolicyFromYAML(t *testing.T, yaml string) (*policy.Policy, error) {
	t.Helper()
	engine := policy.NewEngine()
	err := engine.LoadBytes([]byte(yaml))
	if err != nil {
		return nil, err
	}
	return engine.Policy(), nil
}
