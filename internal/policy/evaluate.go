package policy

import (
	"fmt"
	"path/filepath"
	"slices"
	"strings"

	"github.com/kkd16/parry/internal/check"
	"github.com/kkd16/parry/internal/shellparse"
)

func (e *Engine) Evaluate(tool check.CanonicalTool, toolInput map[string]any) (Action, Tier, error) {
	if e.policy == nil {
		return Block, 0, fmt.Errorf("no policy loaded")
	}

	maxTier := e.policy.MaxTier()
	rule, hasRule := e.policy.Rules[string(tool)]

	tier := e.policy.DefaultTier
	if hasRule && rule.DefaultTier != 0 {
		tier = rule.DefaultTier
	}

	switch tool {
	case check.ToolShell:
		cmd, _ := toolInput["command"].(string)
		if cmd == "" {
			return e.actionForTier(tier), tier, nil
		}

		cmds := shellparse.Parse(cmd)

		if shellparse.HasUnresolved(cmds) {
			return Block, maxTier, nil
		}

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

	case check.ToolFileEdit, check.ToolFileRead:
		path, _ := toolInput["path"].(string)
		if path != "" && e.anyPathProtected([]string{path}) {
			return Block, maxTier, nil
		}
		glob, _ := toolInput["glob"].(string)
		if glob != "" && e.anyPathProtected([]string{glob}) {
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

func (e *Engine) allProtectedPaths() []string {
	all := make([]string, 0, len(e.policy.ParryPaths)+len(e.policy.ProtectedPaths))
	all = append(all, e.policy.ParryPaths...)
	all = append(all, e.policy.ProtectedPaths...)
	return all
}

func (e *Engine) anyPathProtected(paths []string) bool {
	for _, path := range paths {
		base := filepath.Base(path)
		isGlob := containsGlobMeta(path)
		for _, pattern := range e.allProtectedPaths() {
			if matched, _ := filepath.Match(pattern, path); matched {
				return true
			}
			if dir, ok := strings.CutSuffix(pattern, "/*"); ok {
				if strings.HasPrefix(path, dir+"/") {
					return true
				}
			}
			if !strings.Contains(pattern, "/") {
				if matched, _ := filepath.Match(pattern, base); matched {
					return true
				}
			}
			if isGlob {
				patternBase := filepath.Base(pattern)
				if matched, _ := filepath.Match(path, pattern); matched {
					return true
				}
				if !strings.Contains(pattern, "/") {
					if matched, _ := filepath.Match(base, patternBase); matched {
						return true
					}
				}
			}
		}
	}
	return false
}

func containsGlobMeta(path string) bool {
	return strings.ContainsAny(path, "*?[")
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
