package shellparse

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/google/go-cmp/cmp/cmpopts"
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
				{
					Binary:     "ls",
					Positional: []string{"/tmp"},
					ShortFlags: map[string]bool{"l": true, "a": true},
					Resolved:   true,
				},
			},
		},
		{
			name:  "empty string",
			input: "",
			want:  []Command{{}},
		},
		{
			name:  "whitespace only",
			input: "   ",
			want:  []Command{{}},
		},
		{
			name:  "git subcommand as positional",
			input: "git status",
			want: []Command{
				{Binary: "git", Positional: []string{"status"}, Resolved: true},
			},
		},
		{
			name:  "git commit with double-quoted message",
			input: `git commit -m "wip"`,
			want: []Command{
				{
					Binary:     "git",
					Positional: []string{"commit", ""},
					ShortFlags: map[string]bool{"m": true},
					Resolved:   false,
				},
			},
		},
		{
			name:  "docker run alpine",
			input: "docker run alpine",
			want: []Command{
				{Binary: "docker", Positional: []string{"run", "alpine"}, Resolved: true},
			},
		},
		{
			name:  "pipe splits into two commands",
			input: "cat a.txt | grep foo",
			want: []Command{
				{Binary: "cat", Positional: []string{"a.txt"}, Resolved: true},
				{Binary: "grep", Positional: []string{"foo"}, Resolved: true},
			},
		},
		{
			name:  "and-chain",
			input: "make && make test",
			want: []Command{
				{Binary: "make", Resolved: true},
				{Binary: "make", Positional: []string{"test"}, Resolved: true},
			},
		},
		{
			name:  "or-chain",
			input: "false || echo fail",
			want: []Command{
				{Binary: "false", Resolved: true},
				{Binary: "echo", Positional: []string{"fail"}, Resolved: true},
			},
		},
		{
			name:  "semicolon sequence",
			input: "cd /tmp; ls",
			want: []Command{
				{Binary: "cd", Positional: []string{"/tmp"}, Resolved: true},
				{Binary: "ls", Resolved: true},
			},
		},
		{
			name:  "single-quoted literal stays resolved",
			input: "echo 'hello world'",
			want: []Command{
				{Binary: "echo", Positional: []string{"hello world"}, Resolved: true},
			},
		},
		{
			name:  "double-quoted literal is unresolved",
			input: `echo "static"`,
			want: []Command{
				{Binary: "echo", Positional: []string{""}, Resolved: false},
			},
		},
		{
			name:  "param expansion is unresolved",
			input: `echo "$HOME"`,
			want: []Command{
				{Binary: "echo", Positional: []string{""}, Resolved: false},
			},
		},
		{
			name:  "command substitution yields outer plus inner",
			input: "echo $(whoami)",
			want: []Command{
				{Binary: "echo", Positional: []string{""}, Resolved: false},
				{Binary: "whoami", Resolved: true},
			},
		},
		{
			name:  "unquoted variable is unresolved",
			input: "cat $FILE",
			want: []Command{
				{Binary: "cat", Positional: []string{""}, Resolved: false},
			},
		},
		{
			name:  "rm -rf bundled short flags",
			input: "rm -rf /tmp/x",
			want: []Command{
				{
					Binary:     "rm",
					Positional: []string{"/tmp/x"},
					ShortFlags: map[string]bool{"r": true, "f": true},
					Resolved:   true,
				},
			},
		},
		{
			name:  "rm -r -f separated short flags",
			input: "rm -r -f /tmp/x",
			want: []Command{
				{
					Binary:     "rm",
					Positional: []string{"/tmp/x"},
					ShortFlags: map[string]bool{"r": true, "f": true},
					Resolved:   true,
				},
			},
		},
		{
			name:  "rm -rvf with extra unknown flag",
			input: "rm -rvf /tmp/x",
			want: []Command{
				{
					Binary:     "rm",
					Positional: []string{"/tmp/x"},
					ShortFlags: map[string]bool{"r": true, "v": true, "f": true},
					Resolved:   true,
				},
			},
		},
		{
			name:  "rm with long flags",
			input: "rm --recursive --force /tmp/x",
			want: []Command{
				{
					Binary:     "rm",
					Positional: []string{"/tmp/x"},
					LongFlags:  map[string]bool{"recursive": true, "force": true},
					Resolved:   true,
				},
			},
		},
		{
			name:  "POSIX end-of-options treats -rf as positional",
			input: "rm -- -rf",
			want: []Command{
				{Binary: "rm", Positional: []string{"-rf"}, Resolved: true},
			},
		},
		{
			name:  "absolute path binary canonicalizes to basename",
			input: "/bin/rm -rf /tmp/x",
			want: []Command{
				{
					Binary:     "rm",
					Positional: []string{"/tmp/x"},
					ShortFlags: map[string]bool{"r": true, "f": true},
					Resolved:   true,
				},
			},
		},
		{
			name:  "usr/bin path binary canonicalizes to basename",
			input: "/usr/bin/rm -rf /tmp/x",
			want: []Command{
				{
					Binary:     "rm",
					Positional: []string{"/tmp/x"},
					ShortFlags: map[string]bool{"r": true, "f": true},
					Resolved:   true,
				},
			},
		},
		{
			name:  "long flag with equals value drops value",
			input: "curl --data-binary=@foo https://x",
			want: []Command{
				{
					Binary:     "curl",
					Positional: []string{"https://x"},
					LongFlags:  map[string]bool{"data-binary": true},
					Resolved:   true,
				},
			},
		},
		{
			name:  "bash -c with single quotes unwraps",
			input: `bash -c 'rm -rf /tmp/x'`,
			want: []Command{
				{
					Binary:     "rm",
					Positional: []string{"/tmp/x"},
					ShortFlags: map[string]bool{"r": true, "f": true},
					Resolved:   true,
				},
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
				{Binary: "cat", Positional: []string{"a"}, Resolved: true},
				{Binary: "grep", Positional: []string{"b"}, Resolved: true},
			},
		},
		{
			name:  "bash -c with double quotes does not unwrap",
			input: `bash -c "rm -rf /tmp/x"`,
			want: []Command{
				{
					Binary:     "bash",
					Positional: []string{""},
					ShortFlags: map[string]bool{"c": true},
					Resolved:   false,
				},
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
			if diff := cmp.Diff(tc.want, got, cmpopts.EquateEmpty()); diff != "" {
				t.Fatalf("Parse(%q) mismatch (-want +got):\n%s", tc.input, diff)
			}
		})
	}
}

func TestParseBashCNested(t *testing.T) {
	got := Parse(`bash -c 'bash -c "echo inner"'`)
	require.Len(t, got, 1)
	require.Equal(t, "bash", got[0].Binary)
	require.True(t, got[0].ShortFlags["c"])
	require.False(t, got[0].Resolved)
}

func TestClassifyFlags(t *testing.T) {
	tests := []struct {
		name           string
		in             []string
		wantPositional []string
		wantShort      map[string]bool
		wantLong       map[string]bool
	}{
		{
			name: "empty input",
			in:   nil,
		},
		{
			name:      "bundled short",
			in:        []string{"-rf"},
			wantShort: map[string]bool{"r": true, "f": true},
		},
		{
			name:      "separated short",
			in:        []string{"-r", "-f"},
			wantShort: map[string]bool{"r": true, "f": true},
		},
		{
			name:     "long flags",
			in:       []string{"--recursive", "--force"},
			wantLong: map[string]bool{"recursive": true, "force": true},
		},
		{
			name:     "long flag with value",
			in:       []string{"--name=value"},
			wantLong: map[string]bool{"name": true},
		},
		{
			name: "bare end-of-options",
			in:   []string{"--"},
		},
		{
			name:           "tokens after end-of-options are positional",
			in:             []string{"--", "-rf"},
			wantPositional: []string{"-rf"},
		},
		{
			name:           "lone dash is positional",
			in:             []string{"-"},
			wantPositional: []string{"-"},
		},
		{
			name:           "mixed",
			in:             []string{"foo", "-r", "bar", "--", "-x"},
			wantPositional: []string{"foo", "bar", "-x"},
			wantShort:      map[string]bool{"r": true},
		},
		{
			name:           "long and short combined",
			in:             []string{"-v", "--recursive", "file"},
			wantPositional: []string{"file"},
			wantShort:      map[string]bool{"v": true},
			wantLong:       map[string]bool{"recursive": true},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			pos, short, long := ClassifyFlags(tc.in)
			if diff := cmp.Diff(tc.wantPositional, pos, cmpopts.EquateEmpty()); diff != "" {
				t.Errorf("positional mismatch (-want +got):\n%s", diff)
			}
			if diff := cmp.Diff(tc.wantShort, short, cmpopts.EquateEmpty()); diff != "" {
				t.Errorf("short mismatch (-want +got):\n%s", diff)
			}
			if diff := cmp.Diff(tc.wantLong, long, cmpopts.EquateEmpty()); diff != "" {
				t.Errorf("long mismatch (-want +got):\n%s", diff)
			}
		})
	}
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
			name: "positional paths only",
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
			cmds: []Command{{Binary: "echo", Positional: []string{"", "x", ""}}},
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
			if diff := cmp.Diff(tc.want, got, cmpopts.EquateEmpty()); diff != "" {
				t.Fatalf("ExtractArgs mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
