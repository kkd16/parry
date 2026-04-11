package policy_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/kkd16/parry/internal/check"
	"github.com/kkd16/parry/internal/policy"
	"github.com/stretchr/testify/require"
)

const baselineShellYAML = `version: 1
mode: enforce
check_mode_confirm: block
default_action: confirm
protected_paths:
  - "/etc/shadow"
rules:
  shell:
    default_action: confirm
    flag_equivalents:
      rm:
        recursive: [r, R, --recursive]
        force:     [f, --force]
    allow:
      - binary: ls
      - binary: cat
      - binary: echo
    confirm:
      - binary: rm
      - binary: curl
    block:
      - binary: bash
      - binary: rm
        flags: [recursive, force]
`

func TestEvaluate_Shell(t *testing.T) {
	e := loadEngine(t, baselineShellYAML)

	tests := []struct {
		name    string
		command string
		want    policy.Action
	}{
		{"empty command returns rule default", "", policy.Confirm},
		{"allowed binary", "ls", policy.Allow},
		{"unknown binary falls back to rule default", "whoami", policy.Confirm},
		{"confirm binary", "curl https://x", policy.Confirm},
		{"bare rm with file", "rm file.txt", policy.Confirm},
		{"rm -rf blocks", "rm -rf /tmp/x", policy.Block},
		{"rm -fr blocks (flag set order-agnostic)", "rm -fr /tmp/x", policy.Block},
		{"rm -r -f blocks (separated flags)", "rm -r -f /tmp/x", policy.Block},
		{"rm --recursive --force blocks (long flags)", "rm --recursive --force /tmp/x", policy.Block},
		{"rm -Rf blocks (R alias)", "rm -Rf /tmp/x", policy.Block},
		{"/bin/rm -rf blocks (basename canonicalization)", "/bin/rm -rf /tmp/x", policy.Block},
		{"rm -rvf blocks (superset of required flags)", "rm -rvf /tmp/x", policy.Block},
		{"rm -r alone still confirm", "rm -r /tmp/x", policy.Confirm},
		{"pipe strictest wins", "cat a.txt | curl https://x", policy.Confirm},
		{"unresolved command blocks", "cat $VAR", policy.Block},
		{"bash -c single quotes unwraps and inner blocks", "bash -c 'rm -rf /tmp/x'", policy.Block},
		{"bash -c single quotes unwraps long-flag inner", "bash -c 'rm --recursive --force /tmp/x'", policy.Block},
		{"bash -c double quotes blocks via unresolved", `bash -c "ls"`, policy.Block},
		{"protected path in shell", "cat /etc/shadow", policy.Block},
		{"pipe with protected path", "cat /etc/shadow | head", policy.Block},
		{"bash binary directly blocks", "bash", policy.Block},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := e.Evaluate(check.ToolShell, map[string]any{"command": tc.command})
			require.NoError(t, err)
			require.Equal(t, tc.want, got)
		})
	}

	// TODO(bypass-fixes): remaining commented rows below track bypass classes out
	// of scope for the flag-equivalence work. Grep for "TODO(bypass-fixes)" to
	// find every pending bypass across the test suite.
}

const fileToolYAML = `version: 1
mode: enforce
check_mode_confirm: block
default_action: confirm
protected_paths:
  - "/etc/shadow"
  - "~/.ssh/*"
rules:
  shell:
    default_action: confirm
  file_edit:
    default_action: allow
  file_read:
    default_action: allow
`

func TestEvaluate_FilePathTools(t *testing.T) {
	home, err := os.UserHomeDir()
	require.NoError(t, err)
	e := loadEngine(t, fileToolYAML)

	tests := []struct {
		name  string
		tool  check.CanonicalTool
		input map[string]any
		want  policy.Action
	}{
		{
			name:  "file_edit safe path",
			tool:  check.ToolFileEdit,
			input: map[string]any{"path": "/tmp/ok.txt"},
			want:  policy.Allow,
		},
		{
			name:  "file_edit protected literal path",
			tool:  check.ToolFileEdit,
			input: map[string]any{"path": "/etc/shadow"},
			want:  policy.Block,
		},
		{
			name:  "file_edit glob hits protected pattern",
			tool:  check.ToolFileEdit,
			input: map[string]any{"glob": filepath.Join(home, ".ssh", "id_rsa")},
			want:  policy.Block,
		},
		{
			name:  "file_read safe path",
			tool:  check.ToolFileRead,
			input: map[string]any{"path": "/tmp/ok.txt"},
			want:  policy.Allow,
		},
		{
			name:  "file_read protected literal path",
			tool:  check.ToolFileRead,
			input: map[string]any{"path": "/etc/shadow"},
			want:  policy.Block,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := e.Evaluate(tc.tool, tc.input)
			require.NoError(t, err)
			require.Equal(t, tc.want, got)
		})
	}

	t.Run("no policy loaded returns block error", func(t *testing.T) {
		empty := policy.NewEngine()
		got, err := empty.Evaluate(check.ToolFileRead, map[string]any{"path": "x"})
		require.Error(t, err)
		require.Equal(t, policy.Block, got)
	})
}

func TestEvaluate_DefaultPolicy(t *testing.T) {
	e := defaultEngine(t)
	home, err := os.UserHomeDir()
	require.NoError(t, err)

	t.Run("shell", func(t *testing.T) {
		tests := []struct {
			name    string
			command string
			want    policy.Action
		}{
			{"baseline ls", "ls", policy.Allow},
			{"git status", "git status", policy.Allow},
			{"git push", "git push", policy.Confirm},
			{"rm -rf", "rm -rf /", policy.Block},
			{"rm -fr", "rm -fr /", policy.Block},
			{"rm -Rf via R alias", "rm -Rf /", policy.Block},
			{"rm -r -f separated flags", "rm -r -f /", policy.Block},
			{"rm --recursive --force long flags", "rm --recursive --force /", policy.Block},
			{"/bin/rm -rf basename canonicalization", "/bin/rm -rf /", policy.Block},
			{"rm -rvf superset match", "rm -rvf /", policy.Block},
			{"chmod --recursive long form", "chmod --recursive 755 /etc", policy.Block},
			{"chown --recursive long form", "chown --recursive root /etc", policy.Block},
			{"bare rm falls to confirm", "rm /tmp/x", policy.Confirm},
			{"bash binary", "bash", policy.Block},
			{"bash -c single quoted ls allowed", "bash -c 'ls'", policy.Allow},
			{"bash -c single quoted rm -rf blocked", "bash -c 'rm -rf /tmp/x'", policy.Block},
			{"bash -c inner long-flag rm blocked", "bash -c 'rm --recursive --force /tmp/x'", policy.Block},
			{"bash -c double quoted blocked unresolved", `bash -c "ls"`, policy.Block},
			{"sudo blocked", "sudo something", policy.Block},
			{"protected absolute ssh path", "cat " + filepath.Join(home, ".ssh", "id_rsa"), policy.Block},
			{"protected ssh path with flag", "cat -A " + filepath.Join(home, ".ssh", "id_rsa"), policy.Block},
			{"protected /etc/shadow", "cat /etc/shadow", policy.Block},
		}
		for _, tc := range tests {
			t.Run(tc.name, func(t *testing.T) {
				got, err := e.Evaluate(check.ToolShell, map[string]any{"command": tc.command})
				require.NoError(t, err)
				require.Equal(t, tc.want, got)
			})
		}
	})

	t.Run("file tools", func(t *testing.T) {
		tests := []struct {
			name  string
			tool  check.CanonicalTool
			input map[string]any
			want  policy.Action
		}{
			{
				name:  "file_read /etc/shadow blocked",
				tool:  check.ToolFileRead,
				input: map[string]any{"path": "/etc/shadow"},
				want:  policy.Block,
			},
			{
				name:  "file_edit basename .env blocked",
				tool:  check.ToolFileEdit,
				input: map[string]any{"path": "/tmp/project/.env"},
				want:  policy.Block,
			},
		}
		for _, tc := range tests {
			t.Run(tc.name, func(t *testing.T) {
				got, err := e.Evaluate(tc.tool, tc.input)
				require.NoError(t, err)
				require.Equal(t, tc.want, got)
			})
		}
	})

	// TODO(bypass-fixes): remaining uncovered bypass classes are separate
	// work items and NOT addressed by flag-equivalence matching. They live here
	// as a reference for the next iteration:
	//   - curl --data-binary @~/.ssh/id_rsa — value-taking flag path extraction
	//   - cat ~/.ssh/id_rsa — literal tilde in protected paths
	//   - \rm, env rm, python -c "..." — obfuscation and indirect interpreters
	_ = home
}
