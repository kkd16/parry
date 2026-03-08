package dashboard

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"net/http"
	"strconv"

	"github.com/kkd16/parry/frontend"
	"github.com/kkd16/parry/internal/store"
)

type Server struct {
	store    *store.Store
	addr     string
	frontend fs.FS
}

func New(dbPath, addr string) (*Server, error) {
	s, err := store.Open(dbPath)
	if err != nil {
		return nil, fmt.Errorf("opening database: %w", err)
	}
	sub, err := fs.Sub(frontend.Assets, "dist")
	if err != nil {
		_ = s.Close()
		return nil, fmt.Errorf("embedded frontend missing: %w", err)
	}
	return &Server{store: s, addr: addr, frontend: sub}, nil
}

func (s *Server) Run() error {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/events", s.handleEvents)
	mux.Handle("/", s.spaHandler())
	return http.ListenAndServe(s.addr, mux)
}

func (s *Server) Close() error {
	return s.store.Close()
}

func (s *Server) handleEvents(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	limit := intParam(q.Get("limit"), 100, 1, 1000)
	offset := intParam(q.Get("offset"), 0, 0, 1_000_000)
	action := q.Get("action")
	tool := q.Get("tool")

	events, total, err := s.store.ListEvents(limit, offset, action, tool)
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

func (s *Server) spaHandler() http.Handler {
	fileServer := http.FileServer(http.FS(s.frontend))

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if path == "/" {
			fileServer.ServeHTTP(w, r)
			return
		}
		if _, err := fs.Stat(s.frontend, path[1:]); err != nil {
			r.URL.Path = "/"
			fileServer.ServeHTTP(w, r)
			return
		}
		fileServer.ServeHTTP(w, r)
	})
}

func intParam(s string, fallback, min, max int) int {
	if s == "" {
		return fallback
	}
	v, err := strconv.Atoi(s)
	if err != nil {
		return fallback
	}
	if v < min {
		return min
	}
	if v > max {
		return max
	}
	return v
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
