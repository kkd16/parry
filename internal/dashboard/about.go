package dashboard

import (
	"net/http"
	"runtime"
	"runtime/debug"

	"github.com/kkd16/parry/internal/buildinfo"
)

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
