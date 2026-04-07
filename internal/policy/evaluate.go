package policy

import (
	"fmt"
	"path/filepath"
	"strings"

	"github.com/kkd16/parry/internal/check"
	"github.com/kkd16/parry/internal/shellparse"
)

func (e *Engine) Evaluate(tool check.CanonicalTool, toolInput map[string]any) (Action, error) {
	if e.policy == nil {
		return Block, fmt.Errorf("no policy loaded")
	}

	rule, hasRule := e.policy.Rules[string(tool)]

	action := e.policy.DefaultAction
	if hasRule && rule.DefaultAction != "" {
		action = rule.DefaultAction
	}

	switch tool {
	case check.ToolShell:
		cmd, _ := toolInput["command"].(string)
		if cmd == "" {
			return action, nil
		}

		cmds := shellparse.Parse(cmd)

		if shellparse.HasUnresolved(cmds) {
			return Block, nil
		}

		args := shellparse.ExtractArgs(cmds)
		if e.anyPathProtected(args) {
			return Block, nil
		}

		if hasRule && len(cmds) > 0 {
			var worst Action
			for _, c := range cmds {
				worst = strictest(worst, lookupBinaryAction(c, rule.Binaries, action))
			}
			action = worst
		}

	case check.ToolFileEdit, check.ToolFileRead:
		path, _ := toolInput["path"].(string)
		if path != "" && e.anyPathProtected([]string{path}) {
			return Block, nil
		}
		glob, _ := toolInput["glob"].(string)
		if glob != "" && e.anyPathProtected([]string{glob}) {
			return Block, nil
		}
	}

	return action, nil
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

func lookupBinaryAction(cmd shellparse.Command, binaries map[string]Action, fallback Action) Action {
	if binaries == nil {
		return fallback
	}
	if cmd.Subcommand != "" {
		if a, ok := binaries[cmd.Binary+" "+cmd.Subcommand]; ok {
			return a
		}
	}
	if a, ok := binaries[cmd.Binary]; ok {
		return a
	}
	return fallback
}
