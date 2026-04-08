package policy

import "time"

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
	DefaultAction Action            `yaml:"default_action,omitempty" json:"default_action,omitempty"`
	Allow         []string          `yaml:"allow,omitempty" json:"allow,omitempty"`
	Confirm       []string          `yaml:"confirm,omitempty" json:"confirm,omitempty"`
	Block         []string          `yaml:"block,omitempty" json:"block,omitempty"`
	Binaries      map[string]Action `yaml:"-" json:"-"`
}

func (r *Rule) buildBinaries() {
	r.Binaries = make(map[string]Action)
	for _, b := range r.Allow {
		r.Binaries[b] = Allow
	}
	for _, b := range r.Confirm {
		r.Binaries[b] = Confirm
	}
	for _, b := range r.Block {
		r.Binaries[b] = Block
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
	DefaultAction    Action           `yaml:"default_action" json:"default_action"`
	ParryPaths       []string         `yaml:"parry_paths,omitempty" json:"parry_paths,omitempty"`
	ProtectedPaths   []string         `yaml:"protected_paths,omitempty" json:"protected_paths,omitempty"`
	Rules            map[string]*Rule `yaml:"rules" json:"rules"`
	RateLimit        *RateLimit       `yaml:"rate_limit,omitempty" json:"rate_limit,omitempty"`
	Notifications    *Notifications   `yaml:"notifications,omitempty" json:"notifications,omitempty"`
}

func (p *Policy) NotificationsEnabled() bool {
	return p.Notifications != nil && p.Notifications.Provider != ""
}
