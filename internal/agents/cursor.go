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
	check.Register(&CursorAgent{})
	setup.Register(&CursorConfigurer{})
}

// --- Check (runtime hook handling) ---

type CursorAgent struct{}

var cursorToolMapping = map[string]check.CanonicalTool{
	"Shell":  check.ToolShell,
	"Read":   check.ToolFileRead,
	"Write":  check.ToolFileEdit,
	"Grep":   check.ToolFileRead,
	"Delete": check.ToolFileEdit,
}

func (c *CursorAgent) Name() string { return "cursor" }

func (c *CursorAgent) Detect(raw map[string]any) bool {
	event, _ := raw["hook_event_name"].(string)
	return event == "preToolUse"
}

func (c *CursorAgent) Parse(raw map[string]any) (*check.ToolCall, error) {
	toolName, _ := raw["tool_name"].(string)
	if toolName == "" {
		return nil, fmt.Errorf("missing tool_name")
	}
	rawInput, _ := raw["tool_input"].(map[string]any)
	return check.NormalizeTool(toolName, rawInput, cursorToolMapping), nil
}

type cursorResponse struct {
	Permission   string `json:"permission"`
	UserMessage  string `json:"user_message,omitempty"`
	AgentMessage string `json:"agent_message,omitempty"`
}

func (c *CursorAgent) Respond(w io.Writer, result check.Result) error {
	return json.NewEncoder(w).Encode(cursorResponse{
		Permission:  result.Decision,
		UserMessage: result.Message,
	})
}

// --- Setup (hook configuration) ---

type CursorConfigurer struct{}

func (c *CursorConfigurer) Name() string { return "cursor" }

func (c *CursorConfigurer) ConfigPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("finding home directory: %w", err)
	}
	return filepath.Join(home, ".cursor", "hooks.json"), nil
}

func (c *CursorConfigurer) IsInstalled(data map[string]any) bool {
	hooks, _ := data["hooks"].(map[string]any)
	if hooks == nil {
		return false
	}
	entries, _ := hooks["preToolUse"].([]any)
	for _, entry := range entries {
		m, _ := entry.(map[string]any)
		if cmd, _ := m["command"].(string); cmd == "parry check" {
			return true
		}
	}
	return false
}

func (c *CursorConfigurer) Inject(data map[string]any) map[string]any {
	if _, ok := data["version"]; !ok {
		data["version"] = float64(1)
	}
	hooks, _ := data["hooks"].(map[string]any)
	if hooks == nil {
		hooks = make(map[string]any)
	}
	entries, _ := hooks["preToolUse"].([]any)
	entries = append(entries, map[string]any{
		"command":    "parry check",
		"failClosed": true,
	})
	hooks["preToolUse"] = entries
	data["hooks"] = hooks
	return data
}
