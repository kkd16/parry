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

type CanonicalTool string

const (
	ToolShell    CanonicalTool = "shell"
	ToolFileEdit CanonicalTool = "file_edit"
	ToolFileRead CanonicalTool = "file_read"
	ToolUnknown  CanonicalTool = "unknown"
)

// ToolCall is the normalized representation of a tool invocation, regardless of which agent sent it.
type ToolCall struct {
	Tool      CanonicalTool  `json:"tool"`
	RawName   string         `json:"raw_name"`
	ToolInput map[string]any `json:"tool_input"`
}

// Result carries the agent-agnostic policy decision. Each Agent maps this to its wire format.
type Result struct {
	Decision string // "allow" or "deny"
	Message  string // human-readable reason (empty = no message)
}

// Agent handles detection, parsing, and response formatting for a specific coding tool.
type Agent interface {
	Name() string
	Detect(raw map[string]any) bool
	Parse(raw map[string]any) (*ToolCall, error)
	Respond(w io.Writer, result Result) error
}

// NormalizeTool maps an agent-specific tool name and input to a canonical ToolCall
// using the provided mapping table. Unknown tools become ToolUnknown.
func NormalizeTool(rawName string, rawInput map[string]any, mapping map[string]CanonicalTool) *ToolCall {
	canonical, ok := mapping[rawName]
	if !ok {
		canonical = ToolUnknown
	}
	if rawInput == nil {
		rawInput = make(map[string]any)
	}
	return &ToolCall{
		Tool:      canonical,
		RawName:   rawName,
		ToolInput: normalizeInput(canonical, rawInput),
	}
}

func normalizeInput(canonical CanonicalTool, raw map[string]any) map[string]any {
	input := make(map[string]any)
	switch canonical {
	case ToolShell:
		input["command"], _ = raw["command"].(string)
	case ToolFileEdit, ToolFileRead:
		if fp, ok := raw["file_path"].(string); ok {
			input["path"] = fp
		} else if fp, ok := raw["path"].(string); ok {
			input["path"] = fp
		}
		if g, ok := raw["glob"].(string); ok {
			input["glob"] = g
		}
		if p, ok := raw["pattern"].(string); ok {
			input["pattern"] = p
		}
	default:
		for k, v := range raw {
			input[k] = v
		}
	}
	return input
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
