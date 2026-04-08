package dashboard

import (
	"net/http"
	"path/filepath"

	"github.com/kkd16/parry/configs"
	"github.com/kkd16/parry/internal/policy"
)

func (s *Server) loadPolicy() (*policy.Policy, error) {
	engine := policy.NewEngine()
	path := filepath.Join(s.policyDir, "policy.yaml")
	if err := engine.Load(path); err != nil {
		if err := engine.LoadBytes(configs.DefaultPolicy); err != nil {
			return nil, err
		}
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
