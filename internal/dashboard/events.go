package dashboard

import (
	"net/http"

	"github.com/kkd16/parry/internal/store"
)

func (s *Server) handleEvents(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	query := store.EventQuery{
		Limit:     intParam(q.Get("limit"), 100, 1, 1000),
		Offset:    intParam(q.Get("offset"), 0, 0, 1_000_000),
		SinceID:   intParam(q.Get("since_id"), 0, 0, 1_000_000_000),
		Action:    q.Get("action"),
		Tool:      q.Get("tool"),
		Binary:    q.Get("binary"),
		SortCol:   q.Get("sort"),
		SortOrder: q.Get("order"),
		Search:    q.Get("search"),
	}

	events, total, err := s.store.ListEvents(query)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"events": events,
		"total":  total,
		"limit":  query.Limit,
		"offset": query.Offset,
	})
}
