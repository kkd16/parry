package setup

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// Configurer knows how to install/detect parry hooks for one agent.
type Configurer interface {
	Name() string
	ConfigPath() (string, error)
	IsInstalled(data map[string]any) bool
	Inject(data map[string]any) map[string]any
}

var configurers = map[string]Configurer{}

func Register(c Configurer) {
	configurers[c.Name()] = c
}

func Get(name string) (Configurer, bool) {
	c, ok := configurers[name]
	return c, ok
}

// ReadJSONFile reads a JSON file into map[string]any. Returns empty map if file doesn't exist.
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

// WriteJSONFile writes map[string]any to path with 0644 perms, creating parent dirs.
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
