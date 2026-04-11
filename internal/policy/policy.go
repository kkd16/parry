package policy

import (
	"fmt"
	"strings"
	"time"
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

// FlagEquivalents maps a per-binary table of semantic flag names to the set of
// concrete short/long flag forms that satisfy that semantic name. For rm, the
// semantic name `recursive` might resolve to [r, R, --recursive], meaning any
// of those forms seen on the command line counts as the rule's `recursive`
// flag being present.
type FlagEquivalents map[string]map[string][]string

// RuleEntry is a single structured rule under allow/confirm/block. A rule
// matches a command when its binary matches, its positional prefix is a prefix
// of the command's positional args, and every named flag resolves (via
// FlagEquivalents) to a form present in the command.
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

	matchers []compiledMatcher `yaml:"-" json:"-"`
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
	ShortForms map[string]bool
	LongForms  map[string]bool
}

func (r *Rule) compile() error {
	r.matchers = r.matchers[:0]
	groups := []struct {
		action  Action
		entries []RuleEntry
	}{
		{Allow, r.Allow},
		{Confirm, r.Confirm},
		{Block, r.Block},
	}
	for _, g := range groups {
		for i, e := range g.entries {
			m, err := r.compileEntry(e, g.action)
			if err != nil {
				return fmt.Errorf("%s rule %d: %w", g.action, i, err)
			}
			r.matchers = append(r.matchers, m)
		}
	}
	return nil
}

func (r *Rule) compileEntry(e RuleEntry, action Action) (compiledMatcher, error) {
	if e.Binary == "" {
		return compiledMatcher{}, fmt.Errorf("entry missing binary")
	}
	m := compiledMatcher{
		Binary:     e.Binary,
		Positional: append([]string(nil), e.Positional...),
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
		return flagRequirement{}, fmt.Errorf("rule for %q references unknown flag %q — add it under flag_equivalents.%s", binary, name, binary)
	}
	req := flagRequirement{
		Name:       name,
		ShortForms: map[string]bool{},
		LongForms:  map[string]bool{},
	}
	for _, f := range forms {
		if f == "" {
			continue
		}
		trimmed := strings.TrimPrefix(f, "--")
		if len(trimmed) == 1 && !strings.HasPrefix(f, "--") {
			req.ShortForms[trimmed] = true
		} else {
			req.LongForms[trimmed] = true
		}
	}
	if len(req.ShortForms) == 0 && len(req.LongForms) == 0 {
		return flagRequirement{}, fmt.Errorf("flag_equivalents.%s.%s has no forms", binary, name)
	}
	return req, nil
}

// Matchers exposes compiled matchers for test assertions. Not part of the
// stable API.
func (r *Rule) Matchers() []compiledMatcher {
	return r.matchers
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
