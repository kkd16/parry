package policy

import (
	"github.com/kkd16/parry/internal/check"
	"github.com/kkd16/parry/internal/shellparse"
)

type MatchedRule struct {
	Action      Action     `json:"action"`
	Entry       *RuleEntry `json:"entry,omitempty"`
	Specificity int        `json:"specificity"`
	IsDefault   bool       `json:"is_default"`
}

type CommandExplanation struct {
	Binary  string      `json:"binary"`
	Action  Action      `json:"action"`
	Matched MatchedRule `json:"matched"`
}

type ProtectedHit struct {
	Pattern string `json:"pattern"`
	Arg     string `json:"arg"`
}

type Explanation struct {
	Action     Action               `json:"action"`
	Tool       string               `json:"tool"`
	Default    Action               `json:"default"`
	Unresolved bool                 `json:"unresolved"`
	Protected  *ProtectedHit        `json:"protected,omitempty"`
	Commands   []CommandExplanation `json:"commands,omitempty"`
}

func (p *Policy) Explain(tool check.CanonicalTool, toolInput map[string]any) Explanation {
	if p == nil {
		return Explanation{Action: Block, Tool: string(tool)}
	}

	ex := Explanation{
		Tool:    string(tool),
		Default: p.ToolDefaultAction(string(tool)),
	}
	ex.Action = ex.Default

	switch tool {
	case check.ToolShell:
		cmd, _ := toolInput["command"].(string)
		if cmd == "" {
			return ex
		}

		cmds := shellparse.Parse(cmd)

		if shellparse.HasUnresolved(cmds) {
			ex.Unresolved = true
			ex.Action = Block
			return ex
		}

		args := shellparse.ExtractArgs(cmds)
		if pattern, arg, ok := p.FirstProtected(args); ok {
			ex.Protected = &ProtectedHit{Pattern: pattern, Arg: arg}
			ex.Action = Block
			return ex
		}

		if len(cmds) > 0 {
			var worst Action
			for _, c := range cmds {
				ce := p.explainShellCommand(c)
				worst = strictest(worst, ce.Action)
				ex.Commands = append(ex.Commands, ce)
			}
			ex.Action = worst
		}

	case check.ToolFileEdit, check.ToolFileRead:
		for _, key := range []string{"path", "glob"} {
			v, _ := toolInput[key].(string)
			if v == "" {
				continue
			}
			if pattern, arg, ok := p.FirstProtected([]string{v}); ok {
				ex.Protected = &ProtectedHit{Pattern: pattern, Arg: arg}
				ex.Action = Block
				return ex
			}
		}
	}

	return ex
}

func (p *Policy) explainShellCommand(cmd shellparse.Command) CommandExplanation {
	fallback := p.ToolDefaultAction("shell")
	ce := CommandExplanation{Binary: cmd.Binary}

	rule := p.Rules["shell"]
	if rule == nil {
		ce.Action = fallback
		ce.Matched = MatchedRule{Action: fallback, IsDefault: true}
		return ce
	}

	action, m := matchBinaryDetail(cmd, rule.byBinary, fallback)
	ce.Action = action
	if m == nil {
		ce.Matched = MatchedRule{Action: action, IsDefault: true}
		return ce
	}
	ce.Matched = MatchedRule{Action: m.Action, Entry: &m.Entry, Specificity: m.Specificity}
	return ce
}
