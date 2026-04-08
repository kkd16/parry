package dashboard

import (
	"net/http"

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
	p, err := loadPolicy()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, p)
}
