package policy

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestContainsGlobMeta(t *testing.T) {
	tests := []struct {
		name string
		in   string
		want bool
	}{
		{"star", "*", true},
		{"embedded star", "x*y", true},
		{"question", "?", true},
		{"char class", "[a]", true},
		{"plain", "plain", false},
		{"empty", "", false},
		{"path without meta", "/etc/shadow", false},
		{"path with star", "/home/*/ssh", true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.want, containsGlobMeta(tc.in))
		})
	}
}

func engineWithPaths(tb testing.TB, parry, protected []string) *Engine {
	tb.Helper()
	yamlDoc := "version: 1\nmode: enforce\ncheck_mode_confirm: block\ndefault_action: confirm\n"
	if len(parry) > 0 {
		yamlDoc += "parry_paths:\n"
		for _, p := range parry {
			yamlDoc += fmt.Sprintf("  - %q\n", p)
		}
	}
	if len(protected) > 0 {
		yamlDoc += "protected_paths:\n"
		for _, p := range protected {
			yamlDoc += fmt.Sprintf("  - %q\n", p)
		}
	}
	yamlDoc += "rules:\n  shell:\n    default_action: allow\n"

	e := NewEngine()
	require.NoError(tb, e.LoadBytes([]byte(yamlDoc)))
	return e
}

func TestAnyPathProtected(t *testing.T) {
	home, err := os.UserHomeDir()
	require.NoError(t, err)

	tests := []struct {
		name      string
		parry     []string
		protected []string
		inputs    []string
		want      bool
	}{
		{
			name:      "exact literal match",
			protected: []string{"/etc/shadow"},
			inputs:    []string{"/etc/shadow"},
			want:      true,
		},
		{
			name:      "literal miss",
			protected: []string{"/etc/shadow"},
			inputs:    []string{"/etc/passwd"},
			want:      false,
		},
		{
			name:      "home glob suffix matches file inside dir",
			protected: []string{"~/.ssh/*"},
			inputs:    []string{filepath.Join(home, ".ssh", "id_rsa")},
			want:      true,
		},
		{
			name:      "home glob suffix does not match bare dir",
			protected: []string{"~/.ssh/*"},
			inputs:    []string{filepath.Join(home, ".ssh")},
			want:      false,
		},
		{
			name:      "home glob suffix does not match unrelated path",
			protected: []string{"~/.ssh/*"},
			inputs:    []string{"/tmp/ok"},
			want:      false,
		},
		{
			name:      "basename match when pattern has no slash",
			protected: []string{".env"},
			inputs:    []string{"/home/user/project/.env"},
			want:      true,
		},
		{
			name:      "basename miss",
			protected: []string{".env"},
			inputs:    []string{"/home/user/project/.envfile"},
			want:      false,
		},
		{
			name:      "glob pattern with wildcard matches",
			protected: []string{"*credentials*"},
			inputs:    []string{"/any/path/aws-credentials"},
			want:      true,
		},
		{
			name:      "glob pattern with wildcard misses",
			protected: []string{"*credentials*"},
			inputs:    []string{"/safe/path/readme.md"},
			want:      false,
		},
		{
			name:      "empty pattern list",
			protected: nil,
			inputs:    []string{"/etc/shadow"},
			want:      false,
		},
		{
			name:      "empty input list",
			protected: []string{"/etc/shadow"},
			inputs:    nil,
			want:      false,
		},
		{
			name:      "multiple inputs any one matches",
			protected: []string{"/etc/shadow"},
			inputs:    []string{"/tmp/ok", "/etc/shadow", "/tmp/also-ok"},
			want:      true,
		},
		{
			name:   "parry path is included",
			parry:  []string{"~/.parry/*"},
			inputs: []string{filepath.Join(home, ".parry", "policy.yaml")},
			want:   true,
		},
		{
			name:      "both lists combined",
			parry:     []string{"~/.parry/*"},
			protected: []string{"/etc/shadow"},
			inputs:    []string{"/etc/shadow"},
			want:      true,
		},
		{
			name:      "input is a glob that matches a literal protected pattern",
			protected: []string{"/etc/shadow"},
			inputs:    []string{"/etc/sha*"},
			want:      true,
		},
		{
			name:      "input glob with no slash matches bare basename pattern",
			protected: []string{"shadow"},
			inputs:    []string{"*shadow*"},
			want:      true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			e := engineWithPaths(t, tc.parry, tc.protected)
			require.Equal(t, tc.want, e.anyPathProtected(tc.inputs))
		})
	}
}
