package dashboard

import "net/http"

type heatmapFile struct {
	Path  string `json:"path"`
	Count int    `json:"count"`
}

type heatmapProject struct {
	Workdir   string        `json:"workdir"`
	Files     []heatmapFile `json:"files"`
	Total     int           `json:"total"`
	FileCount int           `json:"fileCount"`
}

func (s *Server) handleHeatmap(w http.ResponseWriter, _ *http.Request) {
	rows, totals, err := s.store.FileHeatmap(20)
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
	}

	projects := make([]*heatmapProject, 0, len(order))
	for _, wd := range order {
		p := projectsByDir[wd]
		if t, ok := totals[wd]; ok {
			p.Total = t.Events
			p.FileCount = t.Files
		}
		projects = append(projects, p)
	}

	writeJSON(w, http.StatusOK, map[string]any{"projects": projects})
}
