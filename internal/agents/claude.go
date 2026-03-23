package agents

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/kkd16/parry/internal/check"
	"github.com/kkd16/parry/internal/setup"
)

func init() {
	check.Register(&ClaudeCodeAgent{})
	setup.Register(&ClaudeConfigurer{})
}

// --- Check (runtime hook handling) ---

type ClaudeCodeAgent struct{}

var claudeToolMapping = map[string]check.CanonicalTool{
	"Bash":         check.ToolShell,
	"Write":        check.ToolFileEdit,
	"Edit":         check.ToolFileEdit,
	"Read":         check.ToolFileRead,
	"Glob":         check.ToolFileRead,
	"Grep":         check.ToolFileRead,
	"NotebookEdit": check.ToolFileEdit,
}

func (c *ClaudeCodeAgent) Name() string { return "claude-code" }

func (c *ClaudeCodeAgent) Detect(raw map[string]any) bool {
	event, _ := raw["hook_event_name"].(string)
	return event == "PreToolUse"
}

func (c *ClaudeCodeAgent) Parse(raw map[string]any) (*check.ToolCall, error) {
	toolName, _ := raw["tool_name"].(string)
	if toolName == "" {
		return nil, fmt.Errorf("missing tool_name")
	}
	rawInput, _ := raw["tool_input"].(map[string]any)
	return check.NormalizeTool(toolName, rawInput, claudeToolMapping), nil
}

type claudeResponse struct {
	Decision string `json:"decision"`
	Reason   string `json:"reason,omitempty"`
}

func (c *ClaudeCodeAgent) Respond(w io.Writer, result check.Result) error {
	return json.NewEncoder(w).Encode(claudeResponse{
		Decision: result.Decision,
		Reason:   result.Message,
	})
}

// --- Setup (hook configuration) ---

type ClaudeConfigurer struct{}

func (c *ClaudeConfigurer) Name() string { return "claude" }

func (c *ClaudeConfigurer) ConfigPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("finding home directory: %w", err)
	}
	return filepath.Join(home, ".claude", "settings.json"), nil
}

func (c *ClaudeConfigurer) IsInstalled(data map[string]any) bool {
	hooks, _ := data["hooks"].(map[string]any)
	if hooks == nil {
		return false
	}
	preToolUse, _ := hooks["PreToolUse"].([]any)
	for _, entry := range preToolUse {
		m, _ := entry.(map[string]any)
		innerHooks, _ := m["hooks"].([]any)
		for _, h := range innerHooks {
			hm, _ := h.(map[string]any)
			if cmd, _ := hm["command"].(string); cmd == "parry check" {
				return true
			}
		}
	}
	return false
}

func (c *ClaudeConfigurer) Inject(data map[string]any) map[string]any {
	hooks, _ := data["hooks"].(map[string]any)
	if hooks == nil {
		hooks = make(map[string]any)
	}
	preToolUse, _ := hooks["PreToolUse"].([]any)
	preToolUse = append(preToolUse, map[string]any{
		"matcher": "",
		"hooks": []any{
			map[string]any{
				"type":    "command",
				"command": "parry check",
			},
		},
	})
	hooks["PreToolUse"] = preToolUse
	data["hooks"] = hooks
	return data
}
