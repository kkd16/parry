package policy

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"go.yaml.in/yaml/v4"
)

type Engine struct {
	policy *Policy
}

func NewEngine() *Engine {
	return &Engine{}
}

func (e *Engine) Load(path string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("reading policy file: %w", err)
	}
	return e.LoadBytes(data)
}

func (e *Engine) LoadBytes(data []byte) error {
	var p Policy
	if err := yaml.Unmarshal(data, &p); err != nil {
		return fmt.Errorf("parsing policy YAML: %w", err)
	}
	if err := p.validate(); err != nil {
		return fmt.Errorf("invalid policy: %w", err)
	}
	p.expandHome()
	for _, rule := range p.Rules {
		rule.buildBinaries()
	}
	e.policy = &p
	return nil
}

func (e *Engine) Policy() *Policy {
	return e.policy
}

func (p *Policy) validate() error {
	if p.Version != 1 {
		return fmt.Errorf("unsupported policy version: %d", p.Version)
	}
	if p.Mode != "enforce" && p.Mode != "observe" {
		return fmt.Errorf("invalid mode %q: must be \"enforce\" or \"observe\"", p.Mode)
	}
	if !validActions[p.CheckModeConfirm] {
		return fmt.Errorf("invalid check_mode_confirm %q", p.CheckModeConfirm)
	}
	if !validTier(p.DefaultTier) {
		return fmt.Errorf("invalid default_tier %d: must be >= 1", p.DefaultTier)
	}
	for tier, action := range p.Tiers {
		if !validTier(tier) {
			return fmt.Errorf("invalid tier %d: must be >= 1", tier)
		}
		if !validActions[action] {
			return fmt.Errorf("invalid action %q for tier %d", action, tier)
		}
	}
	for name, rule := range p.Rules {
		if rule.DefaultTier != 0 && !validTier(rule.DefaultTier) {
			return fmt.Errorf("rule %q: invalid default_tier %d", name, rule.DefaultTier)
		}
	}
	for _, pattern := range p.ProtectedPaths {
		if _, err := filepath.Match(pattern, ""); err != nil {
			return fmt.Errorf("invalid protected_paths pattern %q: %w", pattern, err)
		}
	}
	return nil
}

// expandHome replaces leading ~/ in protected_paths with the actual home directory.
// Called after validation so patterns are already known to be valid globs.
func (p *Policy) expandHome() {
	home, _ := os.UserHomeDir()
	if home == "" {
		return
	}
	for i, pattern := range p.ProtectedPaths {
		if strings.HasPrefix(pattern, "~/") {
			p.ProtectedPaths[i] = filepath.Join(home, pattern[2:])
		}
	}
}
