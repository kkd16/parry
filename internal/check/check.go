package check

import (
	"encoding/json"
	"fmt"
	"io"
)

const (
	ExitAllow = 0
	ExitBlock = 2
)

// ToolCall is the normalized representation of a tool invocation, regardless of which agent sent it.
type ToolCall struct {
	ToolName  string         `json:"tool_name"`
	ToolInput map[string]any `json:"tool_input"`
}

// Result carries the agent-agnostic policy decision. Each Agent maps this to its wire format.
type Result struct {
	Decision string // "allow" or "block"
	Message  string // human-readable reason (empty = no message)
}

// Agent handles detection, parsing, and response formatting for a specific coding tool.
type Agent interface {
	Name() string
	Detect(raw map[string]any) bool
	Parse(raw map[string]any) (*ToolCall, error)
	Respond(w io.Writer, result Result) error
}

var agents []Agent

// Register adds an agent to the detection registry. Called from init() in each agent file.
func Register(a Agent) {
	agents = append(agents, a)
}

// ParseInput reads JSON from r, detects which agent sent it, and returns the normalized ToolCall
// along with the matched Agent (needed to format the response later).
func ParseInput(r io.Reader) (*ToolCall, Agent, error) {
	var raw map[string]any
	if err := json.NewDecoder(r).Decode(&raw); err != nil {
		return nil, nil, fmt.Errorf("decoding stdin: %w", err)
	}

	for _, a := range agents {
		if a.Detect(raw) {
			tc, err := a.Parse(raw)
			if err != nil {
				return nil, nil, fmt.Errorf("%s: %w", a.Name(), err)
			}
			return tc, a, nil
		}
	}

	return nil, nil, fmt.Errorf("unrecognized tool call format")
}
