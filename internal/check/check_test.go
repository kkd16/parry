package check_test

import (
	"errors"
	"io"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/kkd16/parry/internal/check"
	"github.com/kkd16/parry/internal/check/mocks"
	"github.com/stretchr/testify/require"
	"go.uber.org/mock/gomock"
)

func TestNormalizeTool(t *testing.T) {
	shellMap := map[string]check.CanonicalTool{
		"Bash":  check.ToolShell,
		"Write": check.ToolFileEdit,
		"Read":  check.ToolFileRead,
	}

	tests := []struct {
		name     string
		rawName  string
		rawInput map[string]any
		mapping  map[string]check.CanonicalTool
		want     *check.ToolCall
	}{
		{
			name:     "shell known with command",
			rawName:  "Bash",
			rawInput: map[string]any{"command": "ls"},
			mapping:  shellMap,
			want: &check.ToolCall{
				Tool:      check.ToolShell,
				RawName:   "Bash",
				ToolInput: map[string]any{"command": "ls"},
			},
		},
		{
			name:     "shell known without command key",
			rawName:  "Bash",
			rawInput: map[string]any{},
			mapping:  shellMap,
			want: &check.ToolCall{
				Tool:      check.ToolShell,
				RawName:   "Bash",
				ToolInput: map[string]any{"command": ""},
			},
		},
		{
			name:     "shell known with non-string command",
			rawName:  "Bash",
			rawInput: map[string]any{"command": 42},
			mapping:  shellMap,
			want: &check.ToolCall{
				Tool:      check.ToolShell,
				RawName:   "Bash",
				ToolInput: map[string]any{"command": ""},
			},
		},
		{
			name:     "file edit with file_path lifted to path",
			rawName:  "Write",
			rawInput: map[string]any{"file_path": "/tmp/x"},
			mapping:  shellMap,
			want: &check.ToolCall{
				Tool:      check.ToolFileEdit,
				RawName:   "Write",
				ToolInput: map[string]any{"path": "/tmp/x"},
			},
		},
		{
			name:     "file edit with path preserved",
			rawName:  "Write",
			rawInput: map[string]any{"path": "/tmp/y"},
			mapping:  shellMap,
			want: &check.ToolCall{
				Tool:      check.ToolFileEdit,
				RawName:   "Write",
				ToolInput: map[string]any{"path": "/tmp/y"},
			},
		},
		{
			name:     "file edit with both file_path and path - file_path wins",
			rawName:  "Write",
			rawInput: map[string]any{"file_path": "/tmp/a", "path": "/tmp/b"},
			mapping:  shellMap,
			want: &check.ToolCall{
				Tool:      check.ToolFileEdit,
				RawName:   "Write",
				ToolInput: map[string]any{"path": "/tmp/a"},
			},
		},
		{
			name:     "file read with glob",
			rawName:  "Read",
			rawInput: map[string]any{"glob": "**/*.go"},
			mapping:  shellMap,
			want: &check.ToolCall{
				Tool:      check.ToolFileRead,
				RawName:   "Read",
				ToolInput: map[string]any{"glob": "**/*.go"},
			},
		},
		{
			name:     "file read with pattern",
			rawName:  "Read",
			rawInput: map[string]any{"pattern": "TODO"},
			mapping:  shellMap,
			want: &check.ToolCall{
				Tool:      check.ToolFileRead,
				RawName:   "Read",
				ToolInput: map[string]any{"pattern": "TODO"},
			},
		},
		{
			name:     "file edit with no recognized keys",
			rawName:  "Write",
			rawInput: map[string]any{"unused": "x"},
			mapping:  shellMap,
			want: &check.ToolCall{
				Tool:      check.ToolFileEdit,
				RawName:   "Write",
				ToolInput: map[string]any{},
			},
		},
		{
			name:     "unknown tool copies raw input verbatim",
			rawName:  "CustomTool",
			rawInput: map[string]any{"a": 1, "b": "two"},
			mapping:  shellMap,
			want: &check.ToolCall{
				Tool:      check.ToolUnknown,
				RawName:   "CustomTool",
				ToolInput: map[string]any{"a": 1, "b": "two"},
			},
		},
		{
			name:    "unknown tool with nested map preserved",
			rawName: "Deep",
			rawInput: map[string]any{
				"outer": map[string]any{"inner": 5},
			},
			mapping: shellMap,
			want: &check.ToolCall{
				Tool:    check.ToolUnknown,
				RawName: "Deep",
				ToolInput: map[string]any{
					"outer": map[string]any{"inner": 5},
				},
			},
		},
		{
			name:     "nil raw input does not panic",
			rawName:  "Bash",
			rawInput: nil,
			mapping:  shellMap,
			want: &check.ToolCall{
				Tool:      check.ToolShell,
				RawName:   "Bash",
				ToolInput: map[string]any{"command": ""},
			},
		},
		{
			name:     "nil mapping falls back to unknown",
			rawName:  "Anything",
			rawInput: map[string]any{"x": 1},
			mapping:  nil,
			want: &check.ToolCall{
				Tool:      check.ToolUnknown,
				RawName:   "Anything",
				ToolInput: map[string]any{"x": 1},
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := check.NormalizeTool(tc.rawName, tc.rawInput, tc.mapping)
			if diff := cmp.Diff(tc.want, got); diff != "" {
				t.Fatalf("NormalizeTool mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func newHookAgent() *check.HookAgent {
	return &check.HookAgent{
		AgentName: "test-agent",
		EventName: "PreToolUse",
		ToolMapping: map[string]check.CanonicalTool{
			"Bash":  check.ToolShell,
			"Write": check.ToolFileEdit,
		},
	}
}

func TestHookAgentDetect(t *testing.T) {
	h := newHookAgent()

	tests := []struct {
		name string
		raw  map[string]any
		want bool
	}{
		{"matching event", map[string]any{"hook_event_name": "PreToolUse"}, true},
		{"different event", map[string]any{"hook_event_name": "PostToolUse"}, false},
		{"missing key", map[string]any{}, false},
		{"non-string value", map[string]any{"hook_event_name": 7}, false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.want, h.Detect(tc.raw))
		})
	}
}

func TestHookAgentParse(t *testing.T) {
	h := newHookAgent()

	t.Run("valid payload", func(t *testing.T) {
		got, err := h.Parse(map[string]any{
			"tool_name":  "Bash",
			"tool_input": map[string]any{"command": "ls"},
		})
		require.NoError(t, err)
		want := &check.ToolCall{
			Tool:      check.ToolShell,
			RawName:   "Bash",
			ToolInput: map[string]any{"command": "ls"},
		}
		if diff := cmp.Diff(want, got); diff != "" {
			t.Fatalf("Parse mismatch (-want +got):\n%s", diff)
		}
	})

	missingCases := []struct {
		name  string
		input map[string]any
	}{
		{"missing tool_name key", map[string]any{}},
		{"empty tool_name value", map[string]any{"tool_name": ""}},
	}
	for _, tc := range missingCases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := h.Parse(tc.input)
			require.Error(t, err)
			require.Contains(t, err.Error(), "tool_name")
		})
	}

	t.Run("non-map tool_input succeeds with empty input", func(t *testing.T) {
		got, err := h.Parse(map[string]any{
			"tool_name":  "Bash",
			"tool_input": "not a map",
		})
		require.NoError(t, err)
		require.Equal(t, check.ToolShell, got.Tool)
		require.Equal(t, "", got.ToolInput["command"])
	})
}

func TestHookAgentRespond(t *testing.T) {
	var got check.Result
	h := &check.HookAgent{
		AgentName: "capture",
		WriteResponse: func(_ io.Writer, r check.Result) error {
			got = r
			return nil
		},
	}
	want := check.Result{Decision: "allow", Message: "ok"}
	require.NoError(t, h.Respond(io.Discard, want))
	require.Equal(t, want, got)
}

func withMockAgents(tb testing.TB, fakes ...check.Agent) {
	tb.Helper()
	restore := check.SetAgentsForTest(fakes)
	tb.Cleanup(restore)
}

func TestParseInput(t *testing.T) {
	t.Run("matching agent", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		m := mocks.NewMockAgent(ctrl)
		tc := &check.ToolCall{Tool: check.ToolShell, RawName: "Bash"}

		m.EXPECT().Detect(gomock.Any()).Return(true)
		m.EXPECT().Parse(gomock.Any()).Return(tc, nil)

		withMockAgents(t, m)

		got, agent, err := check.ParseInput(strings.NewReader(`{"tool_name": "Bash"}`))
		require.NoError(t, err)
		require.Same(t, tc, got)
		require.Same(t, m, agent)
	})

	t.Run("no match", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		m := mocks.NewMockAgent(ctrl)

		m.EXPECT().Detect(gomock.Any()).Return(false)

		withMockAgents(t, m)

		_, _, err := check.ParseInput(strings.NewReader(`{}`))
		require.Error(t, err)
		require.Contains(t, err.Error(), "unrecognized tool call format")
	})

	t.Run("malformed json", func(t *testing.T) {
		withMockAgents(t)
		_, _, err := check.ParseInput(strings.NewReader("not json"))
		require.Error(t, err)
		require.Contains(t, err.Error(), "decoding stdin")
	})

	t.Run("agent parse error is wrapped with name", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		m := mocks.NewMockAgent(ctrl)

		m.EXPECT().Name().Return("failing-agent")
		m.EXPECT().Detect(gomock.Any()).Return(true)
		m.EXPECT().Parse(gomock.Any()).Return(nil, errors.New("boom"))

		withMockAgents(t, m)

		_, _, err := check.ParseInput(strings.NewReader(`{}`))
		require.Error(t, err)
		require.Contains(t, err.Error(), "failing-agent")
		require.Contains(t, err.Error(), "boom")
	})

	t.Run("first match wins", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		first := mocks.NewMockAgent(ctrl)
		second := mocks.NewMockAgent(ctrl)
		tc := &check.ToolCall{Tool: check.ToolShell}

		first.EXPECT().Detect(gomock.Any()).Return(true)
		first.EXPECT().Parse(gomock.Any()).Return(tc, nil)

		withMockAgents(t, first, second)

		got, agent, err := check.ParseInput(strings.NewReader(`{}`))
		require.NoError(t, err)
		require.Same(t, tc, got)
		require.Same(t, first, agent)
	})
}
