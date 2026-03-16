package policy

import (
	"fmt"
	"os"

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
	for name, rule := range p.Rules {
		rule.buildBinaries()
		p.Rules[name] = rule
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
		return fmt.Errorf("invalid default_tier %d: must be 1-5", p.DefaultTier)
	}
	for tier, action := range p.Tiers {
		if !validTier(tier) {
			return fmt.Errorf("unknown tier %d: must be 1-5", tier)
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
	return nil
}
