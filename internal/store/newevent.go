package store

import (
	"github.com/kkd16/parry/internal/check"
	"github.com/kkd16/parry/internal/shellparse"
)

// NewEvent is the canonical mapping from a parsed ToolCall plus verdict into
// an audit Event, including shell binary extraction and file path lifting.
func NewEvent(tc *check.ToolCall, action, mode string) Event {
	e := Event{
		ToolName:  string(tc.Tool),
		ToolInput: tc.ToolInput,
		Action:    action,
		Session:   Session(),
		Mode:      mode,
		RawName:   tc.RawName,
		Workdir:   Workdir(),
	}
	if cmd, ok := tc.ToolInput["command"].(string); ok && cmd != "" {
		cmds := shellparse.Parse(cmd)
		if len(cmds) > 0 {
			e.Binary = cmds[0].Binary
			e.Subcommand = cmds[0].Subcommand
		}
	}
	if p, ok := tc.ToolInput["path"].(string); ok {
		e.File = p
	}
	return e
}
