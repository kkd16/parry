package policy

import (
	"fmt"

	"github.com/kkd16/parry/internal/check"
	"github.com/kkd16/parry/internal/shellparse"
)

func (e *Engine) Evaluate(tool check.CanonicalTool, toolInput map[string]any) (Action, error) {
	if e.policy == nil {
		return Block, fmt.Errorf("no policy loaded")
	}

	action := e.policy.ToolDefaultAction(string(tool))

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

		if len(cmds) > 0 {
			var worst Action
			for _, c := range cmds {
				worst = strictest(worst, e.policy.ShellCommandAction(c))
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
