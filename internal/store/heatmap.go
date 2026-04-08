package store

import "fmt"

type FileHeat struct {
	Workdir string `json:"workdir"`
	Path    string `json:"path"`
	Count   int    `json:"count"`
}

type ProjectTotals struct {
	Events int
	Files  int
}

func (s *Store) FileHeatmap(limitPerProject int) ([]FileHeat, map[string]ProjectTotals, error) {
	rows, err := s.db.Query(`
		SELECT workdir, file, COUNT(*) AS c
		FROM events
		WHERE file != '' AND workdir != ''
		GROUP BY workdir, file
		ORDER BY workdir ASC, c DESC
	`)
	if err != nil {
		return nil, nil, fmt.Errorf("querying file heatmap: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var result []FileHeat
	var currentWorkdir string
	var perProject int
	for rows.Next() {
		var fh FileHeat
		if err := rows.Scan(&fh.Workdir, &fh.Path, &fh.Count); err != nil {
			return nil, nil, fmt.Errorf("scanning heatmap row: %w", err)
		}
		if fh.Workdir != currentWorkdir {
			currentWorkdir = fh.Workdir
			perProject = 0
		}
		if limitPerProject > 0 && perProject >= limitPerProject {
			continue
		}
		perProject++
		result = append(result, fh)
	}
	if err := rows.Err(); err != nil {
		return nil, nil, fmt.Errorf("iterating heatmap rows: %w", err)
	}

	totalRows, err := s.db.Query(`
		SELECT workdir, COUNT(*), COUNT(DISTINCT file)
		FROM events
		WHERE file != '' AND workdir != ''
		GROUP BY workdir
	`)
	if err != nil {
		return nil, nil, fmt.Errorf("querying heatmap totals: %w", err)
	}
	defer func() { _ = totalRows.Close() }()

	totals := make(map[string]ProjectTotals)
	for totalRows.Next() {
		var workdir string
		var events, files int
		if err := totalRows.Scan(&workdir, &events, &files); err != nil {
			return nil, nil, fmt.Errorf("scanning heatmap totals row: %w", err)
		}
		totals[workdir] = ProjectTotals{Events: events, Files: files}
	}
	if err := totalRows.Err(); err != nil {
		return nil, nil, fmt.Errorf("iterating heatmap totals rows: %w", err)
	}

	return result, totals, nil
}
