package policy

import "time"

type Tier int

func validTier(t Tier) bool {
	return t >= 1
}

type Action string

const (
	Allow   Action = "allow"
	Block   Action = "block"
	Confirm Action = "confirm"
)

var validActions = map[Action]bool{
	Allow: true, Block: true, Confirm: true,
}

var validRuleKeys = map[string]bool{
	"shell": true, "file_edit": true, "file_read": true,
}

type Rule struct {
	DefaultTier Tier            `yaml:"default_tier,omitempty" json:"default_tier,omitempty"`
	Tier1       []string        `yaml:"tier_1,omitempty" json:"tier_1,omitempty"`
	Tier2       []string        `yaml:"tier_2,omitempty" json:"tier_2,omitempty"`
	Tier3       []string        `yaml:"tier_3,omitempty" json:"tier_3,omitempty"`
	Tier4       []string        `yaml:"tier_4,omitempty" json:"tier_4,omitempty"`
	Tier5       []string        `yaml:"tier_5,omitempty" json:"tier_5,omitempty"`
	Block       []string        `yaml:"block,omitempty" json:"block,omitempty"`
	Binaries    map[string]Tier `yaml:"-" json:"-"`
}

func (r *Rule) buildBinaries() {
	r.Binaries = make(map[string]Tier)
	for _, b := range r.Tier1 {
		r.Binaries[b] = 1
	}
	for _, b := range r.Tier2 {
		r.Binaries[b] = 2
	}
	for _, b := range r.Tier3 {
		r.Binaries[b] = 3
	}
	for _, b := range r.Tier4 {
		r.Binaries[b] = 4
	}
	for _, b := range r.Tier5 {
		r.Binaries[b] = 5
	}
}

type RateLimit struct {
	Window   string `yaml:"window" json:"window"`
	Max      int    `yaml:"max" json:"max"`
	OnExceed Action `yaml:"on_exceed,omitempty" json:"on_exceed,omitempty"`
}

func (r *RateLimit) ParseWindow() time.Duration {
	d, _ := time.ParseDuration(r.Window)
	return d
}

type Notifications struct {
	Provider            string         `yaml:"provider" json:"provider"`
	ConfirmationTimeout string         `yaml:"confirmation_timeout,omitempty" json:"confirmation_timeout,omitempty"`
	Extra               map[string]any `yaml:",inline" json:"extra,omitempty"`
}

func (n *Notifications) ProviderConfig() map[string]any {
	if n.Extra == nil {
		return nil
	}
	cfg, _ := n.Extra[n.Provider].(map[string]any)
	return cfg
}

func (n *Notifications) ParseTimeout() time.Duration {
	if n.ConfirmationTimeout == "" {
		return 5 * time.Minute
	}
	d, _ := time.ParseDuration(n.ConfirmationTimeout)
	if d <= 0 {
		return 5 * time.Minute
	}
	return d
}

type Policy struct {
	Version          int              `yaml:"version" json:"version"`
	Mode             string           `yaml:"mode" json:"mode"`
	CheckModeConfirm Action           `yaml:"check_mode_confirm" json:"check_mode_confirm"`
	DefaultTier      Tier             `yaml:"default_tier" json:"default_tier"`
	Tiers            map[Tier]Action  `yaml:"tiers" json:"tiers"`
	ParryPaths       []string         `yaml:"parry_paths,omitempty" json:"parry_paths,omitempty"`
	ProtectedPaths   []string         `yaml:"protected_paths,omitempty" json:"protected_paths,omitempty"`
	Rules            map[string]*Rule `yaml:"rules" json:"rules"`
	RateLimit        *RateLimit       `yaml:"rate_limit,omitempty" json:"rate_limit,omitempty"`
	Notifications    *Notifications   `yaml:"notifications,omitempty" json:"notifications,omitempty"`
}

func (p *Policy) NotificationsEnabled() bool {
	return p.Notifications != nil && p.Notifications.Provider != ""
}

func (p *Policy) MaxTier() Tier {
	var max Tier
	for t := range p.Tiers {
		if t > max {
			max = t
		}
	}
	return max
}
