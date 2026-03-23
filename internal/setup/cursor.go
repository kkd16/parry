package setup

import (
	"fmt"
	"os"
	"path/filepath"
)

func init() { Register(&CursorConfigurer{}) }

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
	before, _ := hooks["beforeShellExecution"].([]any)
	for _, entry := range before {
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
	before, _ := hooks["beforeShellExecution"].([]any)
	before = append(before, map[string]any{
		"command":    "parry check",
		"failClosed": true,
	})
	hooks["beforeShellExecution"] = before
	data["hooks"] = hooks
	return data
}
