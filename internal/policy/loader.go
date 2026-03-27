package policy

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/kkd16/parry/internal/notify"
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
	if p.CheckModeConfirm == Confirm {
		return fmt.Errorf("check_mode_confirm cannot be \"confirm\" — must resolve to allow or block")
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
		if !validRuleKeys[name] {
			return fmt.Errorf("unknown rule key %q: must be one of shell, file_edit, file_read", name)
		}
		if rule.DefaultTier != 0 && !validTier(rule.DefaultTier) {
			return fmt.Errorf("rule %q: invalid default_tier %d", name, rule.DefaultTier)
		}
	}
	for _, pattern := range p.ParryPaths {
		if _, err := filepath.Match(pattern, ""); err != nil {
			return fmt.Errorf("invalid parry_paths pattern %q: %w", pattern, err)
		}
	}
	for _, pattern := range p.ProtectedPaths {
		if _, err := filepath.Match(pattern, ""); err != nil {
			return fmt.Errorf("invalid protected_paths pattern %q: %w", pattern, err)
		}
	}
	if n := p.Notifications; n != nil && n.Provider != "" {
		prov, ok := notify.GetProvider(n.Provider)
		if !ok {
			return fmt.Errorf("notifications.provider %q: unknown (available: %s)",
				n.Provider, strings.Join(notify.ProviderNames(), ", "))
		}
		if _, err := prov.NewConfirmer(n.ProviderConfig()); err != nil {
			return err
		}
		if n.ConfirmationTimeout != "" {
			d, err := time.ParseDuration(n.ConfirmationTimeout)
			if err != nil {
				return fmt.Errorf("notifications.confirmation_timeout %q: %w", n.ConfirmationTimeout, err)
			}
			if d <= 0 {
				return fmt.Errorf("notifications.confirmation_timeout must be positive")
			}
		}
	}
	if rl := p.RateLimit; rl != nil {
		d, err := time.ParseDuration(rl.Window)
		if err != nil {
			return fmt.Errorf("rate_limit.window %q: %w", rl.Window, err)
		}
		if d <= 0 {
			return fmt.Errorf("rate_limit.window must be positive")
		}
		if rl.Max < 1 {
			return fmt.Errorf("rate_limit.max must be >= 1")
		}
		if rl.OnExceed == "" {
			p.RateLimit.OnExceed = Block
		} else if !validActions[rl.OnExceed] {
			return fmt.Errorf("rate_limit.on_exceed %q: must be allow, block, or confirm", rl.OnExceed)
		}
	}
	return nil
}

func (p *Policy) expandHome() {
	home, _ := os.UserHomeDir()
	if home == "" {
		return
	}
	for i, pattern := range p.ParryPaths {
		if strings.HasPrefix(pattern, "~/") {
			p.ParryPaths[i] = filepath.Join(home, pattern[2:])
		}
	}
	for i, pattern := range p.ProtectedPaths {
		if strings.HasPrefix(pattern, "~/") {
			p.ProtectedPaths[i] = filepath.Join(home, pattern[2:])
		}
	}
}
