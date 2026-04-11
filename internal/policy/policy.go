package policy

import (
	"fmt"
	"time"

	"github.com/kkd16/parry/internal/shellparse"
)

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

type FlagEquivalents map[string]map[string][]string

type RuleEntry struct {
	Binary     string   `yaml:"binary" json:"binary"`
	Positional []string `yaml:"positional,omitempty" json:"positional,omitempty"`
	Flags      []string `yaml:"flags,omitempty" json:"flags,omitempty"`
}

type Rule struct {
	DefaultAction   Action          `yaml:"default_action,omitempty" json:"default_action,omitempty"`
	FlagEquivalents FlagEquivalents `yaml:"flag_equivalents,omitempty" json:"flag_equivalents,omitempty"`
	Allow           []RuleEntry     `yaml:"allow,omitempty" json:"allow,omitempty"`
	Confirm         []RuleEntry     `yaml:"confirm,omitempty" json:"confirm,omitempty"`
	Block           []RuleEntry     `yaml:"block,omitempty" json:"block,omitempty"`

	byBinary map[string][]compiledMatcher `yaml:"-" json:"-"`
	count    int                          `yaml:"-" json:"-"`
}

type compiledMatcher struct {
	Binary       string
	Positional   []string
	Requirements []flagRequirement
	Action       Action
	Specificity  int
}

type flagRequirement struct {
	Name       string
	ShortForms []string
	LongForms  []string
}

func (r *Rule) compile() error {
	total := len(r.Allow) + len(r.Confirm) + len(r.Block)
	r.byBinary = make(map[string][]compiledMatcher, total)
	r.count = 0

	add := func(entries []RuleEntry, action Action) error {
		for i, e := range entries {
			m, err := r.compileEntry(e, action)
			if err != nil {
				return fmt.Errorf("%s rule %d: %w", action, i, err)
			}
			r.byBinary[m.Binary] = append(r.byBinary[m.Binary], m)
			r.count++
		}
		return nil
	}
	if err := add(r.Allow, Allow); err != nil {
		return err
	}
	if err := add(r.Confirm, Confirm); err != nil {
		return err
	}
	if err := add(r.Block, Block); err != nil {
		return err
	}
	return nil
}

func (r *Rule) compileEntry(e RuleEntry, action Action) (compiledMatcher, error) {
	if e.Binary == "" {
		return compiledMatcher{}, fmt.Errorf("entry missing binary")
	}
	m := compiledMatcher{
		Binary:     e.Binary,
		Positional: e.Positional,
		Action:     action,
	}
	for _, name := range e.Flags {
		req, err := r.resolveFlag(e.Binary, name)
		if err != nil {
			return compiledMatcher{}, err
		}
		m.Requirements = append(m.Requirements, req)
	}
	m.Specificity = len(m.Positional) + len(m.Requirements)
	return m, nil
}

func (r *Rule) resolveFlag(binary, name string) (flagRequirement, error) {
	bin, ok := r.FlagEquivalents[binary]
	if !ok {
		return flagRequirement{}, fmt.Errorf("rule for %q references flag %q but %q has no flag_equivalents entry", binary, name, binary)
	}
	forms, ok := bin[name]
	if !ok {
		return flagRequirement{}, fmt.Errorf("rule for %q references unknown flag %q; add it under flag_equivalents.%s", binary, name, binary)
	}
	req := flagRequirement{Name: name}
	for _, f := range forms {
		if f == "" {
			continue
		}
		short, long := shellparse.ClassifyFlagForm(f)
		if short != "" {
			req.ShortForms = append(req.ShortForms, short)
		}
		if long != "" {
			req.LongForms = append(req.LongForms, long)
		}
	}
	if len(req.ShortForms) == 0 && len(req.LongForms) == 0 {
		return flagRequirement{}, fmt.Errorf("flag_equivalents.%s.%s has no forms", binary, name)
	}
	return req, nil
}

func (r *Rule) MatcherCount() int {
	return r.count
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
