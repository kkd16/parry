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
	DefaultTier Tier            `yaml:"default_tier,omitempty"`
	Tier1       []string        `yaml:"tier_1,omitempty"`
	Tier2       []string        `yaml:"tier_2,omitempty"`
	Tier3       []string        `yaml:"tier_3,omitempty"`
	Tier4       []string        `yaml:"tier_4,omitempty"`
	Tier5       []string        `yaml:"tier_5,omitempty"`
	Block       []string        `yaml:"block,omitempty"`
	Binaries    map[string]Tier `yaml:"-"`
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
	Window   string `yaml:"window"`
	Max      int    `yaml:"max"`
	OnExceed Action `yaml:"on_exceed,omitempty"`
}

func (r *RateLimit) ParseWindow() time.Duration {
	d, _ := time.ParseDuration(r.Window)
	return d
}

type Policy struct {
	Version          int              `yaml:"version"`
	Mode             string           `yaml:"mode"`
	CheckModeConfirm Action           `yaml:"check_mode_confirm"`
	DefaultTier      Tier             `yaml:"default_tier"`
	Tiers            map[Tier]Action  `yaml:"tiers"`
	ParryPaths       []string         `yaml:"parry_paths,omitempty"`
	ProtectedPaths   []string         `yaml:"protected_paths,omitempty"`
	Rules            map[string]*Rule `yaml:"rules"`
	RateLimit        *RateLimit       `yaml:"rate_limit,omitempty"`
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
