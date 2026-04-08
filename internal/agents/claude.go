package agents

import (
	"encoding/json"
	"io"

	"github.com/kkd16/parry/internal/check"
	"github.com/kkd16/parry/internal/setup"
)

type claudeHookOutput struct {
	HookEventName            string `json:"hookEventName"`
	PermissionDecision       string `json:"permissionDecision"`
	PermissionDecisionReason string `json:"permissionDecisionReason,omitempty"`
}

type claudeResponse struct {
	HookSpecificOutput claudeHookOutput `json:"hookSpecificOutput"`
}

var claudeAgent = &check.HookAgent{
	AgentName: "claude-code",
	EventName: "PreToolUse",
	ToolMapping: map[string]check.CanonicalTool{
		"Bash":         check.ToolShell,
		"Write":        check.ToolFileEdit,
		"Edit":         check.ToolFileEdit,
		"Read":         check.ToolFileRead,
		"Glob":         check.ToolFileRead,
		"Grep":         check.ToolFileRead,
		"NotebookEdit": check.ToolFileEdit,
	},
	WriteResponse: func(w io.Writer, result check.Result) error {
		return json.NewEncoder(w).Encode(claudeResponse{
			HookSpecificOutput: claudeHookOutput{
				HookEventName:            "PreToolUse",
				PermissionDecision:       result.Decision,
				PermissionDecisionReason: result.Message,
			},
		})
	},
}

var claudeConfigurer = &setup.HookConfigurer{
	AgentName: "claude",
	RelPath:   []string{".claude", "settings.json"},
	EventKey:  "PreToolUse",
	MatchEntry: func(entry map[string]any) bool {
		innerHooks, _ := entry["hooks"].([]any)
		for _, h := range innerHooks {
			hm, _ := h.(map[string]any)
			if cmd, _ := hm["command"].(string); cmd == "parry check" {
				return true
			}
		}
		return false
	},
	BuildEntry: func() any {
		return map[string]any{
			"matcher": "",
			"hooks": []any{
				map[string]any{
					"type":    "command",
					"command": "parry check",
				},
			},
		}
	},
}
