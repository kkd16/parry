package dashboard

import (
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"time"

	"github.com/kkd16/parry/frontend"
	"github.com/kkd16/parry/internal/policy"
	"github.com/kkd16/parry/internal/store"
)

type Server struct {
	store        *store.Store
	addr         string
	frontend     fs.FS
	logger       *log.Logger
	policyLoader func() (*policy.Policy, error)
}

type Option func(*Server)

func WithLogger(l *log.Logger) Option {
	return func(s *Server) { s.logger = l }
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
	srv := &Server{store: s, addr: addr, frontend: sub, policyLoader: loadPolicy}
	for _, o := range opts {
		o(srv)
	}
	return srv, nil
}

func (s *Server) Close() error {
	return s.store.Close()
}

func (s *Server) Run() error {
	handler := s.routes()
	if s.logger != nil {
		handler = s.logMiddleware(handler)
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
