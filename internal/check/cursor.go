package check

import (
	"encoding/json"
	"io"
)

func init() { Register(&CursorAgent{}) }

// CursorAgent handles Cursor's beforeShellExecution hook.
type CursorAgent struct{}

func (c *CursorAgent) Name() string { return "cursor" }

func (c *CursorAgent) Detect(raw map[string]any) bool {
	event, _ := raw["hook_event_name"].(string)
	return event == "beforeShellExecution"
}

func (c *CursorAgent) Parse(raw map[string]any) (*ToolCall, error) {
	cmd, _ := raw["command"].(string)
	return &ToolCall{
		ToolName:  "shell",
		ToolInput: map[string]any{"command": cmd},
	}, nil
}

type cursorResponse struct {
	Permission   string `json:"permission"`
	UserMessage  string `json:"user_message,omitempty"`
	AgentMessage string `json:"agent_message,omitempty"`
}

func (c *CursorAgent) Respond(w io.Writer, result Result) error {
	perm := result.Decision
	if perm == "block" {
		perm = "deny"
	}
	return json.NewEncoder(w).Encode(cursorResponse{
		Permission:  perm,
		UserMessage: result.Message,
	})
}
