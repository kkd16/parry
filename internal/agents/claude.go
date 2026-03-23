package agents

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"

	"github.com/kkd16/parry/internal/check"
	"github.com/kkd16/parry/internal/setup"
)

func init() {
	check.Register(&ClaudeCodeAgent{})
	setup.Register(&ClaudeConfigurer{})
}

// --- Check (runtime hook handling) ---

// ClaudeCodeAgent handles Claude Code's PreToolUse hook.
type ClaudeCodeAgent struct{}

func (c *ClaudeCodeAgent) Name() string { return "claude-code" }

func (c *ClaudeCodeAgent) Detect(raw map[string]any) bool {
	event, _ := raw["hook_event_name"].(string)
	return event == "PreToolUse"
}

// toolMapping maps Claude Code tool names to Parry's normalized tool names.
var toolMapping = map[string]string{
	"Bash":  "shell",
	"Write": "file_edit",
	"Edit":  "file_edit",
	"Read":  "file_read",
}

func (c *ClaudeCodeAgent) Parse(raw map[string]any) (*check.ToolCall, error) {
	toolName, _ := raw["tool_name"].(string)
	if toolName == "" {
		return nil, fmt.Errorf("missing tool_name")
	}

	rawInput, _ := raw["tool_input"].(map[string]any)
	if rawInput == nil {
		rawInput = make(map[string]any)
	}

	normalized := toolMapping[toolName]
	if normalized == "" {
		normalized = strings.ToLower(toolName)
	}

	input := make(map[string]any)

	switch normalized {
	case "shell":
		input["command"], _ = rawInput["command"].(string)
	case "file_edit", "file_read":
		if fp, ok := rawInput["file_path"].(string); ok {
			input["path"] = fp
		}
	default:
		// Pass through as-is for unknown tools.
		for k, v := range rawInput {
			input[k] = v
		}
	}

	return &check.ToolCall{
		ToolName:  normalized,
		ToolInput: input,
	}, nil
}

type claudeResponse struct {
	Decision string `json:"decision"`
	Reason   string `json:"reason,omitempty"`
}

func (c *ClaudeCodeAgent) Respond(w io.Writer, result check.Result) error {
	decision := result.Decision
	if decision == "block" {
		decision = "deny"
	}
	return json.NewEncoder(w).Encode(claudeResponse{
		Decision: decision,
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
