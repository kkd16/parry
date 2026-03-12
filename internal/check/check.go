package check

import "io"

const (
	ExitAllow = 0
	ExitBlock = 2
)

type ToolCall struct {
	ToolName  string         `json:"tool_name"`
	ToolInput map[string]any `json:"tool_input"`
}

func ParseInput(r io.Reader) (*ToolCall, error) {
	// TODO: decode JSON, auto-detect format (Claude Code / Cursor / Copilot / generic)
	return nil, nil
}
