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

func matchBinary(cmd shellparse.Command, matchers []compiledMatcher, fallback Action) Action {
	if len(matchers) == 0 {
		return fallback
	}
	result := fallback
	bestSpec := -1
	for _, m := range matchers {
		if m.Binary != cmd.Binary {
			continue
		}
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
		case m.Specificity == bestSpec:
			result = strictest(result, m.Action)
		}
	}
	return result
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
	for f := range r.ShortForms {
		if short[f] {
			return true
		}
	}
	for f := range r.LongForms {
		if long[f] {
			return true
		}
	}
	return false
}
