package check

import (
	"encoding/json"
	"fmt"
	"io"
	"os"
)

const (
	ExitAllow = 0
	ExitBlock = 2
)

type ToolCall struct {
	ToolName  string         `json:"tool_name"`
	ToolInput map[string]any `json:"tool_input"`
}

type Response struct {
	Permission   string `json:"permission"`
	UserMessage  string `json:"user_message,omitempty"`
	AgentMessage string `json:"agent_message,omitempty"`
}

func ParseInput(r io.Reader) (*ToolCall, error) {
	var raw map[string]any
	if err := json.NewDecoder(r).Decode(&raw); err != nil {
		return nil, fmt.Errorf("decoding stdin: %w", err)
	}

	// Cursor: {"hook_event_name": "...", "command": "...", ...}
	if _, ok := raw["hook_event_name"]; ok {
		cmd, _ := raw["command"].(string)
		return &ToolCall{
			ToolName:  "Shell",
			ToolInput: map[string]any{"command": cmd},
		}, nil
	}

	return nil, fmt.Errorf("unrecognized tool call format")
}

func Respond(permission string, userMsg string, agentMsg string) {
	json.NewEncoder(os.Stdout).Encode(Response{
		Permission:   permission,
		UserMessage:  userMsg,
		AgentMessage: agentMsg,
	})
}
