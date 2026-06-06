package policy_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/kkd16/parry/internal/check"
	"github.com/kkd16/parry/internal/policy"
	"github.com/stretchr/testify/require"
)

func TestExplain_Shell(t *testing.T) {
	p := loadEngine(t, baselineShellYAML).Policy()

	tests := []struct {
		name    string
		command string
		want    policy.Explanation
	}{
		{
			name:    "empty command returns default with no commands",
			command: "",
			want: policy.Explanation{
				Action: policy.Confirm, Tool: "shell", Default: policy.Confirm,
			},
		},
		{
			name:    "allowed binary reports matched entry",
			command: "ls",
			want: policy.Explanation{
				Action: policy.Allow, Tool: "shell", Default: policy.Confirm,
				Commands: []policy.CommandExplanation{{
					Binary: "ls", Action: policy.Allow,
					Matched: policy.MatchedRule{Action: policy.Allow, Entry: &policy.RuleEntry{Binary: "ls"}},
				}},
			},
		},
		{
			name:    "unknown binary falls to default",
			command: "whoami",
			want: policy.Explanation{
				Action: policy.Confirm, Tool: "shell", Default: policy.Confirm,
				Commands: []policy.CommandExplanation{{
					Binary: "whoami", Action: policy.Confirm,
					Matched: policy.MatchedRule{Action: policy.Confirm, IsDefault: true},
				}},
			},
		},
		{
			name:    "rm -rf reports flag rule with specificity",
			command: "rm -rf /tmp/x",
			want: policy.Explanation{
				Action: policy.Block, Tool: "shell", Default: policy.Confirm,
				Commands: []policy.CommandExplanation{{
					Binary: "rm", Action: policy.Block,
					Matched: policy.MatchedRule{
						Action:      policy.Block,
						Entry:       &policy.RuleEntry{Binary: "rm", Flags: []string{"recursive", "force"}},
						Specificity: 2,
					},
				}},
			},
		},
		{
			name:    "pipeline reports every stage, strictest wins",
			command: "cat a.txt | curl https://x",
			want: policy.Explanation{
				Action: policy.Confirm, Tool: "shell", Default: policy.Confirm,
				Commands: []policy.CommandExplanation{
					{
						Binary: "cat", Action: policy.Allow,
						Matched: policy.MatchedRule{Action: policy.Allow, Entry: &policy.RuleEntry{Binary: "cat"}},
					},
					{
						Binary: "curl", Action: policy.Confirm,
						Matched: policy.MatchedRule{Action: policy.Confirm, Entry: &policy.RuleEntry{Binary: "curl"}},
					},
				},
			},
		},
		{
			name:    "unresolved syntax fails closed",
			command: "cat $VAR",
			want: policy.Explanation{
				Action: policy.Block, Tool: "shell", Default: policy.Confirm,
				Unresolved: true,
			},
		},
		{
			name:    "protected path reports pattern and arg",
			command: "cat /etc/shadow",
			want: policy.Explanation{
				Action: policy.Block, Tool: "shell", Default: policy.Confirm,
				Protected: &policy.ProtectedHit{Pattern: "/etc/shadow", Arg: "/etc/shadow"},
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := p.Explain(check.ToolShell, map[string]any{"command": tc.command})
			if diff := cmp.Diff(tc.want, got); diff != "" {
				t.Errorf("Explain mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestExplain_FileTools(t *testing.T) {
	home, err := os.UserHomeDir()
	require.NoError(t, err)
	p := loadEngine(t, fileToolYAML).Policy()

	tests := []struct {
		name  string
		tool  check.CanonicalTool
		input map[string]any
		want  policy.Explanation
	}{
		{
			name:  "safe path returns tool default",
			tool:  check.ToolFileRead,
			input: map[string]any{"path": "/tmp/ok.txt"},
			want:  policy.Explanation{Action: policy.Allow, Tool: "file_read", Default: policy.Allow},
		},
		{
			name:  "protected literal path",
			tool:  check.ToolFileEdit,
			input: map[string]any{"path": "/etc/shadow"},
			want: policy.Explanation{
				Action: policy.Block, Tool: "file_edit", Default: policy.Allow,
				Protected: &policy.ProtectedHit{Pattern: "/etc/shadow", Arg: "/etc/shadow"},
			},
		},
		{
			name:  "tilde arg reported as passed, pattern expanded",
			tool:  check.ToolFileRead,
			input: map[string]any{"path": "~/.ssh/id_rsa"},
			want: policy.Explanation{
				Action: policy.Block, Tool: "file_read", Default: policy.Allow,
				Protected: &policy.ProtectedHit{Pattern: filepath.Join(home, ".ssh") + "/*", Arg: "~/.ssh/id_rsa"},
			},
		},
		{
			name:  "protected glob input",
			tool:  check.ToolFileEdit,
			input: map[string]any{"glob": filepath.Join(home, ".ssh", "id_rsa")},
			want: policy.Explanation{
				Action: policy.Block, Tool: "file_edit", Default: policy.Allow,
				Protected: &policy.ProtectedHit{
					Pattern: filepath.Join(home, ".ssh") + "/*",
					Arg:     filepath.Join(home, ".ssh", "id_rsa"),
				},
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := p.Explain(tc.tool, tc.input)
			if diff := cmp.Diff(tc.want, got); diff != "" {
				t.Errorf("Explain mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestExplain_NilPolicyFailsClosed(t *testing.T) {
	var p *policy.Policy
	got := p.Explain(check.ToolShell, map[string]any{"command": "ls"})
	require.Equal(t, policy.Block, got.Action)
}
