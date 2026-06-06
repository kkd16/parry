package policy

import "github.com/kkd16/parry/internal/shellparse"

func strictest(a, b Action) Action {
	rank := func(x Action) int {
		switch x {
		case Block:
			return 3
		case Confirm:
			return 2
		case Allow:
			return 1
		default:
			return 0
		}
	}
	if rank(a) >= rank(b) {
		return a
	}
	return b
}

func (p *Policy) ToolDefaultAction(tool string) Action {
	action := p.DefaultAction
	if rule := p.Rules[tool]; rule != nil && rule.DefaultAction != "" {
		action = rule.DefaultAction
	}
	return action
}

func (p *Policy) ShellCommandAction(cmd shellparse.Command) Action {
	return p.explainShellCommand(cmd).Action
}

func matchBinaryDetail(cmd shellparse.Command, byBinary map[string][]compiledMatcher, fallback Action) (Action, *compiledMatcher) {
	bucket := byBinary[cmd.Binary]
	result := fallback
	var winner *compiledMatcher
	bestSpec := -1
	for i := range bucket {
		m := &bucket[i]
		if !positionalPrefix(m.Positional, cmd.Positional) {
			continue
		}
		if !requirementsMet(m.Requirements, cmd.ShortFlags, cmd.LongFlags) {
			continue
		}
		switch {
		case m.Specificity > bestSpec:
			bestSpec = m.Specificity
			result = m.Action
			winner = m
		case m.Specificity == bestSpec:
			if strictest(result, m.Action) != result {
				result = m.Action
				winner = m
			}
		}
	}
	return result, winner
}

func positionalPrefix(rule, cmd []string) bool {
	if len(rule) > len(cmd) {
		return false
	}
	for i := range rule {
		if rule[i] != cmd[i] {
			return false
		}
	}
	return true
}

func requirementsMet(reqs []flagRequirement, short, long map[string]bool) bool {
	for _, r := range reqs {
		if !requirementMet(r, short, long) {
			return false
		}
	}
	return true
}

func requirementMet(r flagRequirement, short, long map[string]bool) bool {
	for _, f := range r.ShortForms {
		if short[f] {
			return true
		}
	}
	for _, f := range r.LongForms {
		if long[f] {
			return true
		}
	}
	return false
}
