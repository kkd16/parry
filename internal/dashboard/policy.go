package dashboard

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/kkd16/parry/internal/check"
	"github.com/kkd16/parry/internal/paths"
	"github.com/kkd16/parry/internal/policy"
)

func loadPolicy() (*policy.Policy, error) {
	engine, err := paths.LoadPolicy()
	if err != nil {
		return nil, err
	}
	return engine.Policy(), nil
}

func (s *Server) handlePolicy(w http.ResponseWriter, _ *http.Request) {
	p, err := s.loadPolicy()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, p)
}

func (s *Server) loadPolicy() (*policy.Policy, error) {
	if s.policyLoader != nil {
		return s.policyLoader()
	}
	return loadPolicy()
}

type evaluateRequest struct {
	Tool      string         `json:"tool"`
	ToolInput map[string]any `json:"tool_input"`
	Command   string         `json:"command"`
}

func (s *Server) handlePolicyEvaluate(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
	var req evaluateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body: " + err.Error()})
		return
	}

	if req.Tool == "" && req.Command != "" {
		req.Tool = string(check.ToolShell)
		req.ToolInput = map[string]any{"command": req.Command}
	}

	tool := check.CanonicalTool(req.Tool)
	switch tool {
	case check.ToolShell, check.ToolFileEdit, check.ToolFileRead:
	default:
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"error": fmt.Sprintf("tool must be one of shell, file_edit, file_read; got %q", req.Tool),
		})
		return
	}

	p, err := s.loadPolicy()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, p.Explain(tool, req.ToolInput))
}
