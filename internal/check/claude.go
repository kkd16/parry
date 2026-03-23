package check

import (
	"encoding/json"
	"fmt"
	"io"
	"strings"
)

func init() { Register(&ClaudeCodeAgent{}) }

// ClaudeCodeAgent handles Claude Code's PreToolUse hook.
type ClaudeCodeAgent struct{}

func (c *ClaudeCodeAgent) Name() string { return "claude-code" }

func (c *ClaudeCodeAgent) Detect(raw map[string]any) bool {
	event, _ := raw["hook_event_name"].(string)
	return event == "PreToolUse"
}

// toolMapping maps Claude Code tool names to Parry's normalized tool names.
var toolMapping = map[string]string{
	"Bash":  "shell",
	"Write": "file_edit",
	"Edit":  "file_edit",
	"Read":  "file_read",
}

func (c *ClaudeCodeAgent) Parse(raw map[string]any) (*ToolCall, error) {
	toolName, _ := raw["tool_name"].(string)
	if toolName == "" {
		return nil, fmt.Errorf("missing tool_name")
	}

	rawInput, _ := raw["tool_input"].(map[string]any)
	if rawInput == nil {
		rawInput = make(map[string]any)
	}

	normalized := toolMapping[toolName]
	if normalized == "" {
		normalized = strings.ToLower(toolName)
	}

	input := make(map[string]any)

	switch normalized {
	case "shell":
		input["command"], _ = rawInput["command"].(string)
	case "file_edit", "file_read":
		if fp, ok := rawInput["file_path"].(string); ok {
			input["path"] = fp
		}
	default:
		// Pass through as-is for unknown tools.
		for k, v := range rawInput {
			input[k] = v
		}
	}

	return &ToolCall{
		ToolName:  normalized,
		ToolInput: input,
	}, nil
}

type claudeResponse struct {
	Decision string `json:"decision"`
	Reason   string `json:"reason,omitempty"`
}

func (c *ClaudeCodeAgent) Respond(w io.Writer, result Result) error {
	decision := result.Decision
	if decision == "block" {
		decision = "deny"
	}
	return json.NewEncoder(w).Encode(claudeResponse{
		Decision: decision,
		Reason:   result.Message,
	})
}
