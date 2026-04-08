package dashboard

import "net/http"

func (s *Server) handleOverview(w http.ResponseWriter, _ *http.Request) {
	o, err := s.store.Overview()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, o)
}
