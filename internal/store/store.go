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

func (s *Store) CountAndRecord(session string, since time.Time, e Event) (int, error) {
	tx, err := s.db.Begin()
	if err != nil {
		return 0, fmt.Errorf("beginning transaction: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	var count int
	err = tx.QueryRow(
		`SELECT COUNT(*) FROM events WHERE session = ? AND timestamp >= ?`,
		session, since.UTC().Format(time.RFC3339),
	).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("counting events: %w", err)
	}

	inputJSON, err := json.Marshal(e.ToolInput)
	if err != nil {
		return 0, fmt.Errorf("marshaling tool_input: %w", err)
	}

	_, err = tx.Exec(
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
		return 0, fmt.Errorf("inserting event: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return 0, fmt.Errorf("committing transaction: %w", err)
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

func (s *Store) ListEvents(limit, offset int, action, tool, sortCol, sortOrder, search string) ([]EventRow, int, error) {
	where := ""
	var args []any

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

	q := "SELECT id, timestamp, tool_name, tool_input, action, session, mode, raw_name, binary, subcommand, file, workdir FROM events WHERE 1=1" + where + " ORDER BY " + orderClause + " LIMIT ? OFFSET ?"
	rowArgs := append(args, limit, offset)
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
