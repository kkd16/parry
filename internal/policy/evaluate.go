package policy

import (
	"fmt"
	"path/filepath"
	"slices"

	"github.com/kkd16/parry/internal/shellparse"
)

func (e *Engine) Evaluate(toolName string, toolInput map[string]any) (Action, Tier, error) {
	if e.policy == nil {
		return Block, 0, fmt.Errorf("no policy loaded")
	}

	maxTier := e.policy.MaxTier()
	rule, hasRule := e.policy.Rules[toolName]

	tier := e.policy.DefaultTier
	if hasRule && rule.DefaultTier != 0 {
		tier = rule.DefaultTier
	}

	switch toolName {
	case "shell":
		cmd, _ := toolInput["command"].(string)
		if cmd == "" {
			return e.actionForTier(tier), tier, nil
		}

		cmds := shellparse.Parse(cmd)

		if hasRule {
			for _, c := range cmds {
				if isBlocked(c.Binary, rule.Block) {
					return Block, maxTier, nil
				}
			}
		}

		args := shellparse.ExtractArgs(cmds)
		if e.anyPathProtected(args) {
			return Block, maxTier, nil
		}

		highest := Tier(0)
		if hasRule {
			for _, c := range cmds {
				t := lookupBinaryTier(c, rule.Binaries, tier)
				if t > highest {
					highest = t
				}
			}
		}
		if highest > 0 {
			tier = highest
		}

	case "file_edit", "file_read":
		path, _ := toolInput["path"].(string)
		if path != "" && e.anyPathProtected([]string{path}) {
			return Block, maxTier, nil
		}
	}

	return e.actionForTier(tier), tier, nil
}

func (e *Engine) actionForTier(tier Tier) Action {
	if action, ok := e.policy.Tiers[tier]; ok {
		return action
	}
	return Block
}

func (e *Engine) anyPathProtected(paths []string) bool {
	for _, path := range paths {
		for _, pattern := range e.policy.ProtectedPaths {
			if matched, _ := filepath.Match(pattern, path); matched {
				return true
			}
		}
	}
	return false
}

func lookupBinaryTier(cmd shellparse.Command, binaries map[string]Tier, fallback Tier) Tier {
	if binaries == nil {
		return fallback
	}
	if cmd.Subcommand != "" {
		if t, ok := binaries[cmd.Binary+" "+cmd.Subcommand]; ok {
			return t
		}
	}
	if t, ok := binaries[cmd.Binary]; ok {
		return t
	}
	return fallback
}

func isBlocked(binary string, blockList []string) bool {
	return slices.Contains(blockList, binary)
}
