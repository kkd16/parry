package agents

import (
	"encoding/json"
	"io"

	"github.com/kkd16/parry/internal/check"
	"github.com/kkd16/parry/internal/setup"
)

func init() {
	check.Register(cursorAgent)
	setup.Register(cursorConfigurer)
}

// --- Check (runtime hook handling) ---

var cursorAgent = &check.HookAgent{
	AgentName: "cursor",
	EventName: "preToolUse",
	ToolMapping: map[string]check.CanonicalTool{
		"Shell":  check.ToolShell,
		"Read":   check.ToolFileRead,
		"Write":  check.ToolFileEdit,
		"Grep":   check.ToolFileRead,
		"Delete": check.ToolFileEdit,
	},
	WriteResponse: func(w io.Writer, result check.Result) error {
		return json.NewEncoder(w).Encode(struct {
			Permission   string `json:"permission"`
			UserMessage  string `json:"user_message,omitempty"`
			AgentMessage string `json:"agent_message,omitempty"`
		}{
			Permission:  result.Decision,
			UserMessage: result.Message,
		})
	},
}

// --- Setup (hook configuration) ---

var cursorConfigurer = &setup.HookConfigurer{
	AgentName: "cursor",
	RelPath:   []string{".cursor", "hooks.json"},
	EventKey:  "preToolUse",
	MatchEntry: func(entry map[string]any) bool {
		cmd, _ := entry["command"].(string)
		return cmd == "parry check"
	},
	BuildEntry: func() any {
		return map[string]any{
			"command":    "parry check",
			"failClosed": true,
		}
	},
	PreInject: func(data map[string]any) {
		if _, ok := data["version"]; !ok {
			data["version"] = float64(1)
		}
	},
}
