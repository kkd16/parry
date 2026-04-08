package check

//go:generate mockgen -destination=mocks/agent.go -package=mocks github.com/kkd16/parry/internal/check Agent

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

type ToolCall struct {
	Tool      CanonicalTool  `json:"tool"`
	RawName   string         `json:"raw_name"`
	ToolInput map[string]any `json:"tool_input"`
}

type Result struct {
	Decision string
	Message  string
}

type Agent interface {
	Name() string
	Detect(raw map[string]any) bool
	Parse(raw map[string]any) (*ToolCall, error)
	Respond(w io.Writer, result Result) error
}

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

type HookAgent struct {
	AgentName     string
	EventName     string
	ToolMapping   map[string]CanonicalTool
	WriteResponse func(w io.Writer, result Result) error
}

func (h *HookAgent) Name() string { return h.AgentName }

func (h *HookAgent) Detect(raw map[string]any) bool {
	event, _ := raw["hook_event_name"].(string)
	return event == h.EventName
}

func (h *HookAgent) Parse(raw map[string]any) (*ToolCall, error) {
	toolName, _ := raw["tool_name"].(string)
	if toolName == "" {
		return nil, fmt.Errorf("missing tool_name")
	}
	rawInput, _ := raw["tool_input"].(map[string]any)
	return NormalizeTool(toolName, rawInput, h.ToolMapping), nil
}

func (h *HookAgent) Respond(w io.Writer, result Result) error {
	return h.WriteResponse(w, result)
}

var agents []Agent

func Register(a Agent) {
	agents = append(agents, a)
}

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
