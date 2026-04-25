package dashboard

import (
	"io/fs"
	"net/http"
)

func (s *Server) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/events", s.handleEvents)
	mux.HandleFunc("GET /api/rule-suggestion", s.handleRuleSuggestion)
	mux.HandleFunc("GET /api/policy", s.handlePolicy)
	mux.HandleFunc("GET /api/notify/health", s.handleNotifyHealth)
	mux.HandleFunc("POST /api/notify/test", s.handleNotifyTest)
	mux.HandleFunc("GET /api/heatmap", s.handleHeatmap)
	mux.HandleFunc("GET /api/overview", s.handleOverview)
	mux.HandleFunc("GET /api/about", s.handleAbout)
	mux.Handle("/", s.spaHandler())
	return mux
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
