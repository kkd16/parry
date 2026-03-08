package setup

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

type Configurer interface {
	Name() string
	ConfigPath() (string, error)
	IsInstalled(data map[string]any) bool
	Inject(data map[string]any) map[string]any
}

type HookConfigurer struct {
	AgentName  string
	RelPath    []string
	EventKey   string
	MatchEntry func(entry map[string]any) bool
	BuildEntry func() any
	PreInject  func(data map[string]any)
}

func (h *HookConfigurer) Name() string { return h.AgentName }

func (h *HookConfigurer) ConfigPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("finding home directory: %w", err)
	}
	parts := append([]string{home}, h.RelPath...)
	return filepath.Join(parts...), nil
}

func (h *HookConfigurer) IsInstalled(data map[string]any) bool {
	hooks, _ := data["hooks"].(map[string]any)
	if hooks == nil {
		return false
	}
	entries, _ := hooks[h.EventKey].([]any)
	for _, entry := range entries {
		m, _ := entry.(map[string]any)
		if h.MatchEntry(m) {
			return true
		}
	}
	return false
}

func (h *HookConfigurer) Inject(data map[string]any) map[string]any {
	if h.PreInject != nil {
		h.PreInject(data)
	}
	hooks, _ := data["hooks"].(map[string]any)
	if hooks == nil {
		hooks = make(map[string]any)
	}
	entries, _ := hooks[h.EventKey].([]any)
	entries = append(entries, h.BuildEntry())
	hooks[h.EventKey] = entries
	data["hooks"] = hooks
	return data
}

var configurers = map[string]Configurer{}

func Register(c Configurer) {
	configurers[c.Name()] = c
}

func Get(name string) (Configurer, bool) {
	c, ok := configurers[name]
	return c, ok
}

func ReadJSONFile(path string) (map[string]any, error) {
	raw, err := os.ReadFile(path)
	if os.IsNotExist(err) {
		return make(map[string]any), nil
	}
	if err != nil {
		return nil, fmt.Errorf("reading %s: %w", path, err)
	}
	var data map[string]any
	if err := json.Unmarshal(raw, &data); err != nil {
		return nil, fmt.Errorf("parsing %s: %w", path, err)
	}
	return data, nil
}

func WriteJSONFile(path string, data map[string]any) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return fmt.Errorf("creating directory for %s: %w", path, err)
	}
	out, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return fmt.Errorf("encoding JSON: %w", err)
	}
	out = append(out, '\n')
	return os.WriteFile(path, out, 0o644)
}
