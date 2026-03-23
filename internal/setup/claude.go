package setup

import (
	"fmt"
	"os"
	"path/filepath"
)

func init() { Register(&ClaudeConfigurer{}) }

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
