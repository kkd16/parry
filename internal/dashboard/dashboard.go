package dashboard

import (
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/kkd16/parry/frontend"
	"github.com/kkd16/parry/internal/store"
)

type Server struct {
	store    *store.Store
	addr     string
	frontend fs.FS
	logger   *log.Logger
}

func New(dbPath, addr string, opts ...Option) (*Server, error) {
	s, err := store.Open(dbPath)
	if err != nil {
		return nil, fmt.Errorf("opening database: %w", err)
	}
	sub, err := fs.Sub(frontend.Assets, "dist")
	if err != nil {
		_ = s.Close()
		return nil, fmt.Errorf("embedded frontend missing: %w", err)
	}
	srv := &Server{store: s, addr: addr, frontend: sub}
	for _, o := range opts {
		o(srv)
	}
	return srv, nil
}

type Option func(*Server)

func WithLogger(l *log.Logger) Option {
	return func(s *Server) { s.logger = l }
}

func (s *Server) Run() error {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/events", s.handleEvents)
	mux.Handle("/", s.spaHandler())

	var handler http.Handler = mux
	if s.logger != nil {
		handler = s.logMiddleware(mux)
	}
	return http.ListenAndServe(s.addr, handler)
}

func (s *Server) logMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		rw := &responseWriter{ResponseWriter: w, status: 200}
		next.ServeHTTP(rw, r)
		path := r.URL.Path
		if r.URL.RawQuery != "" {
			path += "?" + r.URL.RawQuery
		}
		s.logger.Printf("%s %s %d %s", r.Method, path, rw.status, time.Since(start).Round(time.Microsecond))
	})
}

type responseWriter struct {
	http.ResponseWriter
	status int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.status = code
	rw.ResponseWriter.WriteHeader(code)
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
	sort := q.Get("sort")
	order := q.Get("order")
	search := q.Get("search")
	tier := intParam(q.Get("tier"), 0, 0, 5)

	events, total, err := s.store.ListEvents(limit, offset, action, tool, sort, order, search, tier)
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
