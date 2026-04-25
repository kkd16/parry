package store_test

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/kkd16/parry/internal/check"
	"github.com/kkd16/parry/internal/store"
	"github.com/stretchr/testify/require"
)

func TestNewEvent(t *testing.T) {
	session := store.Session()
	workdir := store.Workdir()

	tests := []struct {
		name string
		tc   *check.ToolCall
		want store.Event
	}{
		{
			name: "shell with command",
			tc: &check.ToolCall{
				Tool:      check.ToolShell,
				RawName:   "Bash",
				ToolInput: map[string]any{"command": "rm -rf /tmp/x"},
			},
			want: store.Event{
				ToolName:  string(check.ToolShell),
				ToolInput: map[string]any{"command": "rm -rf /tmp/x"},
				Action:    "block",
				Mode:      "enforce",
				RawName:   "Bash",
				Binary:    "rm",
				Session:   session,
				Workdir:   workdir,
			},
		},
		{
			name: "shell with no command key",
			tc: &check.ToolCall{
				Tool:      check.ToolShell,
				RawName:   "Bash",
				ToolInput: map[string]any{},
			},
			want: store.Event{
				ToolName:  string(check.ToolShell),
				ToolInput: map[string]any{},
				Action:    "block",
				Mode:      "enforce",
				RawName:   "Bash",
				Session:   session,
				Workdir:   workdir,
			},
		},
		{
			name: "shell with non-string command",
			tc: &check.ToolCall{
				Tool:      check.ToolShell,
				RawName:   "Bash",
				ToolInput: map[string]any{"command": 42},
			},
			want: store.Event{
				ToolName:  string(check.ToolShell),
				ToolInput: map[string]any{"command": 42},
				Action:    "block",
				Mode:      "enforce",
				RawName:   "Bash",
				Session:   session,
				Workdir:   workdir,
			},
		},
		{
			name: "file_edit with path",
			tc: &check.ToolCall{
				Tool:      check.ToolFileEdit,
				RawName:   "Write",
				ToolInput: map[string]any{"path": "/tmp/x"},
			},
			want: store.Event{
				ToolName:  string(check.ToolFileEdit),
				ToolInput: map[string]any{"path": "/tmp/x"},
				Action:    "block",
				Mode:      "enforce",
				RawName:   "Write",
				File:      "/tmp/x",
				Session:   session,
				Workdir:   workdir,
			},
		},
		{
			name: "file_read with no path",
			tc: &check.ToolCall{
				Tool:      check.ToolFileRead,
				RawName:   "Read",
				ToolInput: map[string]any{},
			},
			want: store.Event{
				ToolName:  string(check.ToolFileRead),
				ToolInput: map[string]any{},
				Action:    "block",
				Mode:      "enforce",
				RawName:   "Read",
				Session:   session,
				Workdir:   workdir,
			},
		},
		{
			name: "unknown tool passthrough",
			tc: &check.ToolCall{
				Tool:      check.ToolUnknown,
				RawName:   "Custom",
				ToolInput: map[string]any{"anything": 1},
			},
			want: store.Event{
				ToolName:  string(check.ToolUnknown),
				ToolInput: map[string]any{"anything": 1},
				Action:    "block",
				Mode:      "enforce",
				RawName:   "Custom",
				Session:   session,
				Workdir:   workdir,
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := store.NewEvent(tc.tc, "block", "enforce")
			if diff := cmp.Diff(tc.want, got); diff != "" {
				t.Fatalf("NewEvent mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestEventRowCanonicalTool(t *testing.T) {
	tests := []struct {
		name string
		ev   store.EventRow
		want string
	}{
		{
			name: "canonical shell is preserved",
			ev:   store.EventRow{ToolName: string(check.ToolShell)},
			want: string(check.ToolShell),
		},
		{
			name: "binary implies shell for legacy row",
			ev:   store.EventRow{ToolName: "Bash", Binary: "git"},
			want: string(check.ToolShell),
		},
		{
			name: "command implies shell for legacy row",
			ev:   store.EventRow{ToolName: "Bash", ToolInput: map[string]any{"command": "git status"}},
			want: string(check.ToolShell),
		},
		{
			name: "file implies file_edit for legacy row",
			ev:   store.EventRow{ToolName: "Write", File: "/tmp/x"},
			want: string(check.ToolFileEdit),
		},
		{
			name: "unknown stays unknown",
			ev:   store.EventRow{ToolName: "Custom", ToolInput: map[string]any{"anything": 1}},
			want: "Custom",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.want, tc.ev.CanonicalTool())
		})
	}
}
