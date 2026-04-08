package store

import (
	"database/sql"
	"fmt"
	"sort"
	"time"
)

type ActionCount struct {
	Action string `json:"action"`
	Count  int    `json:"count"`
}

type BinaryStat struct {
	Binary  string         `json:"binary"`
	Count   int            `json:"count"`
	Actions map[string]int `json:"actions"`
}

type ProjectStat struct {
	Workdir string `json:"workdir"`
	Count   int    `json:"count"`
}

type DayBucket struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
}

type Overview struct {
	Total        int           `json:"total"`
	Today        int           `json:"today"`
	Last7d       []DayBucket   `json:"last_7d"`
	ByAction     []ActionCount `json:"by_action"`
	TopBinaries  []BinaryStat  `json:"top_binaries"`
	TopProject   *ProjectStat  `json:"top_project,omitempty"`
	RecentBlocks []EventRow    `json:"recent_blocks"`
}

func (s *Store) Overview() (*Overview, error) {
	o := &Overview{}

	if err := s.db.QueryRow("SELECT COUNT(*) FROM events").Scan(&o.Total); err != nil {
		return nil, fmt.Errorf("counting events: %w", err)
	}

	now := time.Now().UTC()
	startOfToday := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	if err := s.db.QueryRow(
		"SELECT COUNT(*) FROM events WHERE timestamp >= ?",
		startOfToday.Format(time.RFC3339Nano),
	).Scan(&o.Today); err != nil {
		return nil, fmt.Errorf("counting today: %w", err)
	}

	dayMap := make(map[string]int)
	startOf7d := startOfToday.AddDate(0, 0, -6)
	rows, err := s.db.Query(
		"SELECT substr(timestamp, 1, 10) AS d, COUNT(*) FROM events WHERE timestamp >= ? GROUP BY d ORDER BY d",
		startOf7d.Format(time.RFC3339Nano),
	)
	if err != nil {
		return nil, fmt.Errorf("querying 7d: %w", err)
	}
	for rows.Next() {
		var d string
		var c int
		if err := rows.Scan(&d, &c); err != nil {
			_ = rows.Close()
			return nil, fmt.Errorf("scanning 7d row: %w", err)
		}
		dayMap[d] = c
	}
	_ = rows.Close()
	for i := range 7 {
		d := startOf7d.AddDate(0, 0, i).Format("2006-01-02")
		o.Last7d = append(o.Last7d, DayBucket{Date: d, Count: dayMap[d]})
	}

	rows, err = s.db.Query("SELECT action, COUNT(*) FROM events GROUP BY action ORDER BY 2 DESC")
	if err != nil {
		return nil, fmt.Errorf("querying actions: %w", err)
	}
	for rows.Next() {
		var ac ActionCount
		if err := rows.Scan(&ac.Action, &ac.Count); err != nil {
			_ = rows.Close()
			return nil, fmt.Errorf("scanning action row: %w", err)
		}
		o.ByAction = append(o.ByAction, ac)
	}
	_ = rows.Close()

	rows, err = s.db.Query(
		"SELECT binary, action, COUNT(*) FROM events WHERE binary != '' GROUP BY binary, action",
	)
	if err != nil {
		return nil, fmt.Errorf("querying binaries: %w", err)
	}
	binMap := make(map[string]*BinaryStat)
	for rows.Next() {
		var b, a string
		var c int
		if err := rows.Scan(&b, &a, &c); err != nil {
			_ = rows.Close()
			return nil, fmt.Errorf("scanning binary row: %w", err)
		}
		bs, ok := binMap[b]
		if !ok {
			bs = &BinaryStat{Binary: b, Actions: make(map[string]int)}
			binMap[b] = bs
		}
		bs.Actions[a] += c
		bs.Count += c
	}
	_ = rows.Close()
	for _, bs := range binMap {
		o.TopBinaries = append(o.TopBinaries, *bs)
	}
	sort.Slice(o.TopBinaries, func(i, j int) bool {
		return o.TopBinaries[i].Count > o.TopBinaries[j].Count
	})
	if len(o.TopBinaries) > 5 {
		o.TopBinaries = o.TopBinaries[:5]
	}

	var topWd string
	var topCount int
	if err := s.db.QueryRow(
		"SELECT workdir, COUNT(*) AS c FROM events WHERE workdir != '' GROUP BY workdir ORDER BY c DESC LIMIT 1",
	).Scan(&topWd, &topCount); err == nil {
		o.TopProject = &ProjectStat{Workdir: topWd, Count: topCount}
	} else if err != sql.ErrNoRows {
		return nil, fmt.Errorf("querying top project: %w", err)
	}

	blocks, _, err := s.ListEvents(5, 0, 0, "block", "", "timestamp", "desc", "")
	if err != nil {
		return nil, fmt.Errorf("recent blocks: %w", err)
	}
	o.RecentBlocks = blocks

	return o, nil
}
