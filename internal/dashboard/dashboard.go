package dashboard

import (
	"context"
	"encoding/json"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"path/filepath"
	"runtime"
	"runtime/debug"
	"strconv"
	"strings"
	"time"

	"github.com/kkd16/parry/configs"
	"github.com/kkd16/parry/frontend"
	"github.com/kkd16/parry/internal/buildinfo"
	"github.com/kkd16/parry/internal/notify"
	"github.com/kkd16/parry/internal/policy"
	"github.com/kkd16/parry/internal/store"
)

type Server struct {
	store     *store.Store
	addr      string
	frontend  fs.FS
	logger    *log.Logger
	policyDir string
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

func WithPolicyDir(dir string) Option {
	return func(s *Server) { s.policyDir = dir }
}

func (s *Server) Run() error {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/events", s.handleEvents)
	mux.HandleFunc("GET /api/policy", s.handlePolicy)
	mux.HandleFunc("GET /api/notify/health", s.handleNotifyHealth)
	mux.HandleFunc("POST /api/notify/test", s.handleNotifyTest)
	mux.HandleFunc("GET /api/heatmap", s.handleHeatmap)
	mux.HandleFunc("GET /api/overview", s.handleOverview)
	mux.HandleFunc("GET /api/about", s.handleAbout)
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

func (s *Server) handleAbout(w http.ResponseWriter, _ *http.Request) {
	commit := ""
	built := ""
	if info, ok := debug.ReadBuildInfo(); ok {
		for _, st := range info.Settings {
			switch st.Key {
			case "vcs.revision":
				if len(st.Value) >= 8 {
					commit = st.Value[:8]
				} else {
					commit = st.Value
				}
			case "vcs.time":
				built = st.Value
			}
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"version":    buildinfo.Version,
		"go_version": runtime.Version(),
		"commit":     commit,
		"built":      built,
		"platform":   runtime.GOOS + "/" + runtime.GOARCH,
		"data_dir":   s.policyDir,
	})
}

func (s *Server) handleOverview(w http.ResponseWriter, r *http.Request) {
	o, err := s.store.Overview()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, o)
}

type heatmapFile struct {
	Path  string `json:"path"`
	Count int    `json:"count"`
}

type heatmapProject struct {
	Workdir string         `json:"workdir"`
	Files   []heatmapFile  `json:"files"`
	Total   int            `json:"total"`
}

func (s *Server) handleHeatmap(w http.ResponseWriter, r *http.Request) {
	rows, err := s.store.FileHeatmap(20)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	projectsByDir := make(map[string]*heatmapProject)
	var order []string
	for _, fh := range rows {
		p, ok := projectsByDir[fh.Workdir]
		if !ok {
			p = &heatmapProject{Workdir: fh.Workdir}
			projectsByDir[fh.Workdir] = p
			order = append(order, fh.Workdir)
		}
		p.Files = append(p.Files, heatmapFile{Path: fh.Path, Count: fh.Count})
		p.Total += fh.Count
	}

	projects := make([]*heatmapProject, 0, len(order))
	for _, wd := range order {
		projects = append(projects, projectsByDir[wd])
	}

	writeJSON(w, http.StatusOK, map[string]any{"projects": projects})
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

func (s *Server) handleNotifyHealth(w http.ResponseWriter, _ *http.Request) {
	p, err := s.loadPolicy()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	if !p.NotificationsEnabled() {
		writeJSON(w, http.StatusOK, map[string]string{"status": "unconfigured"})
		return
	}

	cfg := p.Notifications.ProviderConfig()
	topic, _ := cfg["topic"].(string)
	server, _ := cfg["server"].(string)
	if server == "" {
		server = "https://ntfy.sh"
	}

	result := map[string]string{
		"status":   "ok",
		"provider": p.Notifications.Provider,
		"topic":    topic,
		"server":   server,
	}

	if topic == "" {
		result["status"] = "error"
		result["error"] = "no topic configured"
		writeJSON(w, http.StatusOK, result)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	url := strings.TrimRight(server, "/") + "/" + topic + "/json?poll=1&since=" + strconv.FormatInt(time.Now().Unix(), 10)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		result["status"] = "error"
		result["error"] = err.Error()
		writeJSON(w, http.StatusOK, result)
		return
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		result["status"] = "error"
		result["error"] = "unreachable"
		writeJSON(w, http.StatusOK, result)
		return
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		result["status"] = "error"
		result["error"] = fmt.Sprintf("ntfy returned %d", resp.StatusCode)
		writeJSON(w, http.StatusOK, result)
		return
	}

	writeJSON(w, http.StatusOK, result)
}

func (s *Server) handleNotifyTest(w http.ResponseWriter, _ *http.Request) {
	p, err := s.loadPolicy()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if !p.NotificationsEnabled() {
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":    false,
			"error": "no notification provider configured",
		})
		return
	}

	provider, ok := notify.GetProvider(p.Notifications.Provider)
	if !ok {
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":    false,
			"error": "unknown provider: " + p.Notifications.Provider,
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := provider.SendTest(ctx, p.Notifications.ProviderConfig()); err != nil {
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":      false,
			"error":   err.Error(),
			"sent_at": time.Now().UTC().Format(time.RFC3339),
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"sent_at": time.Now().UTC().Format(time.RFC3339),
	})
}

func (s *Server) handlePolicy(w http.ResponseWriter, _ *http.Request) {
	p, err := s.loadPolicy()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, p)
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
