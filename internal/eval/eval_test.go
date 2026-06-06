package eval

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/kkd16/parry/internal/check"
	"github.com/kkd16/parry/internal/policy"
	"github.com/stretchr/testify/require"
)

func writeCorpus(t *testing.T, files map[string]string) string {
	t.Helper()
	dir := t.TempDir()
	for name, content := range files {
		path := filepath.Join(dir, name)
		require.NoError(t, os.MkdirAll(filepath.Dir(path), 0o755))
		require.NoError(t, os.WriteFile(path, []byte(content), 0o644))
	}
	return dir
}

func loadEngine(t *testing.T, yamlDoc string) *policy.Engine {
	t.Helper()
	e := policy.NewEngine()
	require.NoError(t, e.LoadBytes([]byte(yamlDoc)))
	return e
}

const runnerPolicy = `version: 1
mode: enforce
check_mode_confirm: block
default_action: confirm
rules:
  shell:
    default_action: confirm
    flag_equivalents:
      rm:
        recursive: [r, R, --recursive]
        force: [f, --force]
    allow:
      - binary: ls
    block:
      - binary: rm
        flags: [recursive, force]
`

func TestLoad(t *testing.T) {
	t.Parallel()
	dir := writeCorpus(t, map[string]string{
		"hostile_shell.yaml": `- id: hs-001
  tool: shell
  tool_input:
    command: rm -rf /
  expect: block
  notes: plain destructive
- id: hs-002
  tool: file_read
  tool_input:
    path: ~/.ssh/id_rsa
  expect: block
  bypass: true
`,
	})

	entries, err := Load(dir)
	require.NoError(t, err)

	want := []Entry{
		{
			ID:        "hs-001",
			Category:  "hostile_shell",
			Tool:      "shell",
			ToolInput: map[string]any{"command": "rm -rf /"},
			Expect:    "block",
			Notes:     "plain destructive",
			expected:  policy.Block,
			canonical: check.ToolShell,
		},
		{
			ID:        "hs-002",
			Category:  "hostile_shell",
			Tool:      "file_read",
			ToolInput: map[string]any{"path": "~/.ssh/id_rsa"},
			Expect:    "block",
			Bypass:    true,
			expected:  policy.Block,
			canonical: check.ToolFileRead,
		},
	}
	if diff := cmp.Diff(want, entries, cmp.AllowUnexported(Entry{})); diff != "" {
		t.Fatalf("entries mismatch (-want +got):\n%s", diff)
	}
}

func TestLoadMultipleFilesSortedOrder(t *testing.T) {
	t.Parallel()
	dir := writeCorpus(t, map[string]string{
		"b_exfil.yaml":  "- {id: ex-001, tool: shell, expect: block}\n",
		"a_benign.yaml": "- {id: bn-001, tool: shell, expect: allow}\n",
	})

	entries, err := Load(dir)
	require.NoError(t, err)
	require.Len(t, entries, 2)
	require.Equal(t, "bn-001", entries[0].ID)
	require.Equal(t, "a_benign", entries[0].Category)
	require.Equal(t, "ex-001", entries[1].ID)
	require.Equal(t, "b_exfil", entries[1].Category)
}

func TestLoadExtensionsAndNesting(t *testing.T) {
	t.Parallel()
	dir := writeCorpus(t, map[string]string{
		"cases.yml":       "- {id: a-001, tool: shell, expect: allow}\n",
		"sub/nested.yaml": "- {id: a-002, tool: shell, expect: allow}\n",
		"README.md":       "# not a corpus file\n",
		"notes.txt":       "id: bogus\n",
	})

	entries, err := Load(dir)
	require.NoError(t, err)
	require.Len(t, entries, 2)
	require.Equal(t, "a-001", entries[0].ID)
	require.Equal(t, "nested", entries[1].Category)
}

func TestLoadEmptyDir(t *testing.T) {
	t.Parallel()
	entries, err := Load(t.TempDir())
	require.NoError(t, err)
	require.Empty(t, entries)
}

func TestLoadMissingDir(t *testing.T) {
	t.Parallel()
	_, err := Load(filepath.Join(t.TempDir(), "nope"))
	require.ErrorContains(t, err, "walking eval dir")
}

func TestLoadErrors(t *testing.T) {
	t.Parallel()
	tests := []struct {
		name    string
		files   map[string]string
		wantErr []string
	}{
		{
			name:    "missing id",
			files:   map[string]string{"a.yaml": "- {tool: shell, expect: allow}\n"},
			wantErr: []string{"missing id"},
		},
		{
			name:    "missing tool",
			files:   map[string]string{"a.yaml": "- {id: x-1, expect: allow}\n"},
			wantErr: []string{"x-1", "missing tool"},
		},
		{
			name:    "missing expect",
			files:   map[string]string{"a.yaml": "- {id: x-1, tool: shell}\n"},
			wantErr: []string{"x-1", "missing expect"},
		},
		{
			name:    "invalid expect",
			files:   map[string]string{"a.yaml": "- {id: x-1, tool: shell, expect: maybe}\n"},
			wantErr: []string{`invalid expect "maybe"`},
		},
		{
			name:    "invalid tool",
			files:   map[string]string{"a.yaml": "- {id: x-1, tool: browser, expect: allow}\n"},
			wantErr: []string{`invalid tool "browser"`},
		},
		{
			name: "duplicate id same file",
			files: map[string]string{
				"a.yaml": "- {id: x-1, tool: shell, expect: allow}\n- {id: x-1, tool: shell, expect: block}\n",
			},
			wantErr: []string{`duplicate entry id "x-1"`},
		},
		{
			name: "duplicate id across files",
			files: map[string]string{
				"a.yaml": "- {id: x-1, tool: shell, expect: allow}\n",
				"b.yaml": "- {id: x-1, tool: shell, expect: block}\n",
			},
			wantErr: []string{`duplicate entry id "x-1"`, "a.yaml", "b.yaml"},
		},
		{
			name:    "malformed yaml",
			files:   map[string]string{"a.yaml": "- [unclosed\n"},
			wantErr: []string{"parsing"},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			_, err := Load(writeCorpus(t, tt.files))
			require.Error(t, err)
			for _, want := range tt.wantErr {
				require.ErrorContains(t, err, want)
			}
		})
	}
}

func TestRunMixedBatch(t *testing.T) {
	t.Parallel()
	engine := loadEngine(t, runnerPolicy)
	entries := []Entry{
		// got allow == expected allow -> pass, not hostile
		{ID: "benign-pass", ToolInput: map[string]any{"command": "ls -la"}, expected: policy.Allow, canonical: check.ToolShell},
		// got block == expected block -> pass, hostile + caught
		{ID: "hostile-pass", ToolInput: map[string]any{"command": "rm -rf /tmp/x"}, expected: policy.Block, canonical: check.ToolShell},
		// got confirm != expected block -> fail, but confirm still counts as caught
		{ID: "hostile-fail", ToolInput: map[string]any{"command": "echo hi"}, expected: policy.Block, canonical: check.ToolShell},
		// got allow != expected block, flagged bypass -> known bypass + true bypass
		{ID: "hostile-bypass", Bypass: true, ToolInput: map[string]any{"command": "ls"}, expected: policy.Block, canonical: check.ToolShell},
		// got block != expected allow -> fail (false positive), not hostile
		{ID: "benign-fail", ToolInput: map[string]any{"command": "rm -rf /tmp/x"}, expected: policy.Allow, canonical: check.ToolShell},
	}

	s := Run(engine, entries)

	require.Len(t, s.Results, len(entries))
	wantPass := []bool{true, true, false, false, false}
	for i, r := range s.Results {
		require.Equal(t, entries[i].ID, r.Entry.ID, "result order")
		require.Equal(t, wantPass[i], r.Pass, "Pass for %s", r.Entry.ID)
		require.NoError(t, r.Err, "Err for %s", r.Entry.ID)
	}

	s.Results = nil
	want := Summary{Total: 5, Pass: 2, Fail: 2, Bypasses: 1, Hostile: 3, Caught: 2, TrueBypass: 1}
	if diff := cmp.Diff(want, s); diff != "" {
		t.Fatalf("summary mismatch (-want +got):\n%s", diff)
	}
}

func TestRunNoPolicyLoaded(t *testing.T) {
	t.Parallel()
	engine := policy.NewEngine()
	entries := []Entry{
		{ID: "e-1", ToolInput: map[string]any{"command": "ls"}, expected: policy.Block, canonical: check.ToolShell},
	}

	s := Run(engine, entries)

	require.Len(t, s.Results, 1)
	require.Error(t, s.Results[0].Err)
	require.False(t, s.Results[0].Pass)
	require.Equal(t, policy.Block, s.Results[0].Got, "errored evaluation fails closed")

	s.Results = nil
	// hostile accounting still runs for errored entries; block counts as caught
	want := Summary{Total: 1, Errored: 1, Hostile: 1, Caught: 1}
	if diff := cmp.Diff(want, s); diff != "" {
		t.Fatalf("summary mismatch (-want +got):\n%s", diff)
	}
}

func TestRunEmpty(t *testing.T) {
	t.Parallel()
	s := Run(loadEngine(t, runnerPolicy), nil)
	require.NotNil(t, s.Results)
	require.Empty(t, s.Results)

	s.Results = nil
	if diff := cmp.Diff(Summary{}, s); diff != "" {
		t.Fatalf("summary mismatch (-want +got):\n%s", diff)
	}
}

func TestInputPreview(t *testing.T) {
	t.Parallel()
	longCmd := strings.Repeat("a", 60)
	tests := []struct {
		name  string
		input map[string]any
		want  string
	}{
		{"command", map[string]any{"command": "rm -rf /"}, "rm -rf /"},
		{"command truncated", map[string]any{"command": longCmd}, longCmd[:47] + "..."},
		{"path fallback", map[string]any{"command": "", "path": "~/.ssh/id_rsa"}, "~/.ssh/id_rsa"},
		{"neither", map[string]any{"other": 1}, ""},
		{"nil input", nil, ""},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			require.Equal(t, tt.want, inputPreview(Entry{ToolInput: tt.input}))
		})
	}
}
