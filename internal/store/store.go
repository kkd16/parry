package store

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"time"

	_ "modernc.org/sqlite"
)

const schema = `
CREATE TABLE IF NOT EXISTS events (
	id         INTEGER PRIMARY KEY AUTOINCREMENT,
	timestamp  TEXT    NOT NULL,
	tool_name  TEXT    NOT NULL,
	tool_input TEXT    NOT NULL,
	action     TEXT    NOT NULL,
	session    TEXT    NOT NULL,
	mode       TEXT    NOT NULL,
	raw_name   TEXT    NOT NULL DEFAULT '',
	binary     TEXT    NOT NULL DEFAULT '',
	subcommand TEXT    NOT NULL DEFAULT '',
	file       TEXT    NOT NULL DEFAULT '',
	workdir    TEXT    NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
`

type Store struct {
	db *sql.DB
}

type Event struct {
	ToolName   string
	ToolInput  map[string]any
	Action     string
	Session    string
	Mode       string
	RawName    string
	Binary     string
	Subcommand string
	File       string
	Workdir    string
}

func Open(dbPath string) (*Store, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("opening database: %w", err)
	}

	for _, pragma := range []string{
		"PRAGMA journal_mode=WAL",
		"PRAGMA synchronous=NORMAL",
		"PRAGMA busy_timeout=5000",
	} {
		if _, err := db.Exec(pragma); err != nil {
			_ = db.Close()
			return nil, fmt.Errorf("setting %s: %w", pragma, err)
		}
	}

	if _, err := db.Exec(schema); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("initializing schema: %w", err)
	}

	return &Store{db: db}, nil
}

func (s *Store) RecordEvent(e Event) error {
	inputJSON, err := json.Marshal(e.ToolInput)
	if err != nil {
		return fmt.Errorf("marshaling tool_input: %w", err)
	}

	_, err = s.db.Exec(
		`INSERT INTO events (timestamp, tool_name, tool_input, action, session, mode, raw_name, binary, subcommand, file, workdir)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		time.Now().UTC().Format(time.RFC3339),
		e.ToolName,
		string(inputJSON),
		e.Action,
		e.Session,
		e.Mode,
		e.RawName,
		e.Binary,
		e.Subcommand,
		e.File,
		e.Workdir,
	)
	if err != nil {
		return fmt.Errorf("inserting event: %w", err)
	}
	return nil
}

func (s *Store) CountSince(session string, since time.Time) (int, error) {
	var count int
	err := s.db.QueryRow(
		`SELECT COUNT(*) FROM events WHERE session = ? AND timestamp >= ?`,
		session, since.UTC().Format(time.RFC3339),
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("counting events since %s: %w", since.Format(time.RFC3339), err)
	}
	return count, nil
}

func (s *Store) Close() error {
	return s.db.Close()
}

type EventRow struct {
	ID         int            `json:"id"`
	Timestamp  string         `json:"timestamp"`
	ToolName   string         `json:"tool_name"`
	ToolInput  map[string]any `json:"tool_input"`
	Action     string         `json:"action"`
	Session    string         `json:"session"`
	Mode       string         `json:"mode"`
	RawName    string         `json:"raw_name"`
	Binary     string         `json:"binary"`
	Subcommand string         `json:"subcommand"`
	File       string         `json:"file"`
	Workdir    string         `json:"workdir"`
}

// allowedSortCols is the whitelist of columns that can be sorted on.
var allowedSortCols = map[string]string{
	"timestamp":  "timestamp",
	"tool_name":  "tool_name",
	"action":     "action",
	"mode":       "mode",
	"raw_name":   "raw_name",
	"binary":     "binary",
	"subcommand": "subcommand",
	"file":       "file",
	"workdir":    "workdir",
}

func (s *Store) ListEvents(limit, offset, sinceID int, action, tool, sortCol, sortOrder, search string) ([]EventRow, int, error) {
	where := ""
	var args []any

	if sinceID > 0 {
		where += " AND id > ?"
		args = append(args, sinceID)
	}
	if action != "" {
		where += " AND action = ?"
		args = append(args, action)
	}
	if tool != "" {
		where += " AND tool_name = ?"
		args = append(args, tool)
	}
	if search != "" {
		where += " AND (tool_input LIKE ? OR tool_name LIKE ? OR session LIKE ?)"
		like := "%" + search + "%"
		args = append(args, like, like, like)
	}

	var total int
	countQ := "SELECT COUNT(*) FROM events WHERE 1=1" + where
	if err := s.db.QueryRow(countQ, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("counting events: %w", err)
	}

	orderClause := "id DESC"
	if col, ok := allowedSortCols[sortCol]; ok {
		dir := "DESC"
		if sortOrder == "asc" {
			dir = "ASC"
		}
		orderClause = col + " " + dir + ", id " + dir
	}

	var q string
	var rowArgs []any
	if sinceID > 0 {
		// incremental tail: oldest-new first, no offset
		q = "SELECT id, timestamp, tool_name, tool_input, action, session, mode, raw_name, binary, subcommand, file, workdir FROM events WHERE 1=1" + where + " ORDER BY id ASC LIMIT ?"
		rowArgs = append(args, limit)
	} else {
		q = "SELECT id, timestamp, tool_name, tool_input, action, session, mode, raw_name, binary, subcommand, file, workdir FROM events WHERE 1=1" + where + " ORDER BY " + orderClause + " LIMIT ? OFFSET ?"
		rowArgs = append(args, limit, offset)
	}
	rows, err := s.db.Query(q, rowArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("querying events: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var result []EventRow
	for rows.Next() {
		var ev EventRow
		var inputJSON string
		if err := rows.Scan(&ev.ID, &ev.Timestamp, &ev.ToolName, &inputJSON, &ev.Action, &ev.Session, &ev.Mode, &ev.RawName, &ev.Binary, &ev.Subcommand, &ev.File, &ev.Workdir); err != nil {
			return nil, 0, fmt.Errorf("scanning event: %w", err)
		}
		if err := json.Unmarshal([]byte(inputJSON), &ev.ToolInput); err != nil {
			log.Printf("warning: malformed tool_input JSON for event %d: %v", ev.ID, err)
			ev.ToolInput = map[string]any{"raw": inputJSON}
		}
		result = append(result, ev)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterating events: %w", err)
	}

	return result, total, nil
}

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
	Total          int            `json:"total"`
	Today          int            `json:"today"`
	Last7d         []DayBucket    `json:"last_7d"`
	ByAction       []ActionCount  `json:"by_action"`
	TopBinaries    []BinaryStat   `json:"top_binaries"`
	TopProject     *ProjectStat   `json:"top_project,omitempty"`
	RecentBlocks   []EventRow     `json:"recent_blocks"`
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

	// last 7 days bucketed by date (UTC)
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

	// action distribution
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

	// top 5 binaries with action mix
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
	// sort + truncate to 5
	for i := 0; i < len(o.TopBinaries); i++ {
		for j := i + 1; j < len(o.TopBinaries); j++ {
			if o.TopBinaries[j].Count > o.TopBinaries[i].Count {
				o.TopBinaries[i], o.TopBinaries[j] = o.TopBinaries[j], o.TopBinaries[i]
			}
		}
	}
	if len(o.TopBinaries) > 5 {
		o.TopBinaries = o.TopBinaries[:5]
	}

	// most active project
	var topWd string
	var topCount int
	if err := s.db.QueryRow(
		"SELECT workdir, COUNT(*) AS c FROM events WHERE workdir != '' GROUP BY workdir ORDER BY c DESC LIMIT 1",
	).Scan(&topWd, &topCount); err == nil {
		o.TopProject = &ProjectStat{Workdir: topWd, Count: topCount}
	} else if err != sql.ErrNoRows {
		return nil, fmt.Errorf("querying top project: %w", err)
	}

	// recent blocks (last 5)
	blocks, _, err := s.ListEvents(5, 0, 0, "block", "", "timestamp", "desc", "")
	if err != nil {
		return nil, fmt.Errorf("recent blocks: %w", err)
	}
	o.RecentBlocks = blocks

	return o, nil
}

type FileHeat struct {
	Workdir string `json:"workdir"`
	Path    string `json:"path"`
	Count   int    `json:"count"`
}

func (s *Store) FileHeatmap(limitPerProject int) ([]FileHeat, error) {
	rows, err := s.db.Query(`
		SELECT workdir, file, COUNT(*) AS c
		FROM events
		WHERE file != '' AND workdir != ''
		GROUP BY workdir, file
		ORDER BY workdir ASC, c DESC
	`)
	if err != nil {
		return nil, fmt.Errorf("querying file heatmap: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var result []FileHeat
	var currentWorkdir string
	var perProject int
	for rows.Next() {
		var fh FileHeat
		if err := rows.Scan(&fh.Workdir, &fh.Path, &fh.Count); err != nil {
			return nil, fmt.Errorf("scanning heatmap row: %w", err)
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
		return nil, fmt.Errorf("iterating heatmap rows: %w", err)
	}
	return result, nil
}

func Session() string {
	cwd, err := os.Getwd()
	if err != nil {
		return "unknown"
	}
	h := sha256.Sum256([]byte(cwd))
	return hex.EncodeToString(h[:])
}

func Workdir() string {
	cwd, err := os.Getwd()
	if err != nil {
		return ""
	}
	return cwd
}
