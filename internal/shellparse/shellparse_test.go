package shellparse

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/stretchr/testify/require"
)

func TestParse(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  []Command
	}{
		{
			name:  "bare binary",
			input: "ls",
			want:  []Command{{Binary: "ls", Resolved: true}},
		},
		{
			name:  "flags and path",
			input: "ls -la /tmp",
			want: []Command{
				{Binary: "ls", Subcommand: "-la", Args: []string{"-la", "/tmp"}, Resolved: true},
			},
		},
		{
			name:  "empty string",
			input: "",
			want:  []Command{{Binary: ""}},
		},
		{
			name:  "whitespace only",
			input: "   ",
			want:  []Command{{Binary: ""}},
		},
		{
			name:  "git subcommand",
			input: "git status",
			want: []Command{
				{Binary: "git", Subcommand: "status", Args: []string{"status"}, Resolved: true},
			},
		},
		{
			name:  "git commit with double-quoted message",
			input: `git commit -m "wip"`,
			want: []Command{
				{Binary: "git", Subcommand: "commit", Args: []string{"commit", "-m", ""}, Resolved: false},
			},
		},
		{
			name:  "docker run",
			input: "docker run alpine",
			want: []Command{
				{Binary: "docker", Subcommand: "run", Args: []string{"run", "alpine"}, Resolved: true},
			},
		},
		{
			name:  "pipe splits into two commands",
			input: "cat a.txt | grep foo",
			want: []Command{
				{Binary: "cat", Subcommand: "a.txt", Args: []string{"a.txt"}, Resolved: true},
				{Binary: "grep", Subcommand: "foo", Args: []string{"foo"}, Resolved: true},
			},
		},
		{
			name:  "and-chain",
			input: "make && make test",
			want: []Command{
				{Binary: "make", Resolved: true},
				{Binary: "make", Subcommand: "test", Args: []string{"test"}, Resolved: true},
			},
		},
		{
			name:  "or-chain",
			input: "false || echo fail",
			want: []Command{
				{Binary: "false", Resolved: true},
				{Binary: "echo", Subcommand: "fail", Args: []string{"fail"}, Resolved: true},
			},
		},
		{
			name:  "semicolon sequence",
			input: "cd /tmp; ls",
			want: []Command{
				{Binary: "cd", Subcommand: "/tmp", Args: []string{"/tmp"}, Resolved: true},
				{Binary: "ls", Resolved: true},
			},
		},
		{
			name:  "single-quoted literal stays resolved",
			input: "echo 'hello world'",
			want: []Command{
				{Binary: "echo", Subcommand: "hello world", Args: []string{"hello world"}, Resolved: true},
			},
		},
		{
			name:  "double-quoted literal is unresolved",
			input: `echo "static"`,
			want: []Command{
				{Binary: "echo", Args: []string{""}, Resolved: false},
			},
		},
		{
			name:  "param expansion is unresolved",
			input: `echo "$HOME"`,
			want: []Command{
				{Binary: "echo", Args: []string{""}, Resolved: false},
			},
		},
		{
			name:  "command substitution yields outer plus inner",
			input: "echo $(whoami)",
			want: []Command{
				{Binary: "echo", Args: []string{""}, Resolved: false},
				{Binary: "whoami", Resolved: true},
			},
		},
		{
			name:  "unquoted variable is unresolved",
			input: "cat $FILE",
			want: []Command{
				{Binary: "cat", Args: []string{""}, Resolved: false},
			},
		},
		{
			name:  "bash -c with single quotes unwraps",
			input: `bash -c 'rm -rf /tmp/x'`,
			want: []Command{
				{Binary: "rm", Subcommand: "-rf", Args: []string{"-rf", "/tmp/x"}, Resolved: true},
			},
		},
		{
			name:  "sh -c with single quotes unwraps",
			input: `sh -c 'ls'`,
			want: []Command{
				{Binary: "ls", Resolved: true},
			},
		},
		{
			name:  "bash -c single-quoted pipe unwraps to both commands",
			input: `bash -c 'cat a | grep b'`,
			want: []Command{
				{Binary: "cat", Subcommand: "a", Args: []string{"a"}, Resolved: true},
				{Binary: "grep", Subcommand: "b", Args: []string{"b"}, Resolved: true},
			},
		},
		{
			name:  "bash -c with double quotes does not unwrap",
			input: `bash -c "rm -rf /tmp/x"`,
			want: []Command{
				{Binary: "bash", Subcommand: "-c", Args: []string{"-c", ""}, Resolved: false},
			},
		},
		{
			name:  "syntax error falls back to first word",
			input: ")",
			want:  []Command{{Binary: ")"}},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := Parse(tc.input)
			if diff := cmp.Diff(tc.want, got); diff != "" {
				t.Fatalf("Parse(%q) mismatch (-want +got):\n%s", tc.input, diff)
			}
		})
	}
}

func TestParseBashCNested(t *testing.T) {
	got := Parse(`bash -c 'bash -c "echo inner"'`)
	require.Len(t, got, 1)
	require.Equal(t, "bash", got[0].Binary)
	require.Equal(t, "-c", got[0].Subcommand)
	require.False(t, got[0].Resolved)
}

func TestHasUnresolved(t *testing.T) {
	tests := []struct {
		name string
		cmds []Command
		want bool
	}{
		{"empty slice", nil, false},
		{"all resolved", []Command{{Binary: "ls", Resolved: true}, {Binary: "cat", Resolved: true}}, false},
		{"one unresolved", []Command{{Binary: "ls", Resolved: true}, {Binary: "cat", Resolved: false}}, true},
		{"all unresolved", []Command{{Binary: "cat", Resolved: false}}, true},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.want, HasUnresolved(tc.cmds))
		})
	}
}

func TestExtractArgs(t *testing.T) {
	tests := []struct {
		name string
		cmds []Command
		want []string
	}{
		{
			name: "flags are skipped",
			cmds: Parse("ls -la /tmp"),
			want: []string{"/tmp"},
		},
		{
			name: "duplicates are deduped",
			cmds: Parse("cat a.txt a.txt"),
			want: []string{"a.txt"},
		},
		{
			name: "cross-command collection preserves first-seen order",
			cmds: Parse("cat a.txt | grep b.txt file.log"),
			want: []string{"a.txt", "b.txt", "file.log"},
		},
		{
			name: "empty strings are filtered",
			cmds: []Command{{Binary: "echo", Args: []string{"", "x", ""}}},
			want: []string{"x"},
		},
		{
			name: "no args yields nil",
			cmds: []Command{{Binary: "ls"}},
			want: nil,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := ExtractArgs(tc.cmds)
			if diff := cmp.Diff(tc.want, got); diff != "" {
				t.Fatalf("ExtractArgs mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
