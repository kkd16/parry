package dashboard

import "net/http"

func (s *Server) handleEvents(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	limit := intParam(q.Get("limit"), 100, 1, 1000)
	offset := intParam(q.Get("offset"), 0, 0, 1_000_000)
	action := q.Get("action")
	tool := q.Get("tool")
	sort := q.Get("sort")
	order := q.Get("order")
	search := q.Get("search")
	sinceID := intParam(q.Get("since_id"), 0, 0, 1_000_000_000)

	events, total, err := s.store.ListEvents(limit, offset, sinceID, action, tool, sort, order, search)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"events": events,
		"total":  total,
		"limit":  limit,
		"offset": offset,
	})
}
