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
	tier       INTEGER NOT NULL,
	action     TEXT    NOT NULL,
	session    TEXT    NOT NULL,
	mode       TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_session ON events(session);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
`

type Store struct {
	db *sql.DB
}

type Event struct {
	ToolName  string
	ToolInput map[string]any
	Tier      int
	Action    string
	Session   string
	Mode      string
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
		`INSERT INTO events (timestamp, tool_name, tool_input, tier, action, session, mode)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		time.Now().UTC().Format(time.RFC3339),
		e.ToolName,
		string(inputJSON),
		e.Tier,
		e.Action,
		e.Session,
		e.Mode,
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
		`INSERT INTO events (timestamp, tool_name, tool_input, tier, action, session, mode)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
		time.Now().UTC().Format(time.RFC3339),
		e.ToolName,
		string(inputJSON),
		e.Tier,
		e.Action,
		e.Session,
		e.Mode,
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
	ID        int            `json:"id"`
	Timestamp string         `json:"timestamp"`
	ToolName  string         `json:"tool_name"`
	ToolInput map[string]any `json:"tool_input"`
	Tier      int            `json:"tier"`
	Action    string         `json:"action"`
	Session   string         `json:"session"`
	Mode      string         `json:"mode"`
}

func (s *Store) ListEvents(limit, offset int, action, tool string) ([]EventRow, int, error) {
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

	var total int
	countQ := "SELECT COUNT(*) FROM events WHERE 1=1" + where
	if err := s.db.QueryRow(countQ, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("counting events: %w", err)
	}

	q := "SELECT id, timestamp, tool_name, tool_input, tier, action, session, mode FROM events WHERE 1=1" + where + " ORDER BY id DESC LIMIT ? OFFSET ?"
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
		if err := rows.Scan(&ev.ID, &ev.Timestamp, &ev.ToolName, &inputJSON, &ev.Tier, &ev.Action, &ev.Session, &ev.Mode); err != nil {
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

type Summary struct {
	Total        int
	ByAction     map[string]int
	ByTier       map[int]int
	TopCommands  []CommandCount
}

type CommandCount struct {
	Command string
	Count   int
}

func (s *Store) Report() (*Summary, error) {
	sum := &Summary{
		ByAction: make(map[string]int),
		ByTier:   make(map[int]int),
	}

	rows, err := s.db.Query("SELECT action, COUNT(*) FROM events GROUP BY action")
	if err != nil {
		return nil, fmt.Errorf("querying actions: %w", err)
	}
	for rows.Next() {
		var action string
		var count int
		if err := rows.Scan(&action, &count); err != nil {
			_ = rows.Close()
			return nil, fmt.Errorf("scanning action row: %w", err)
		}
		sum.ByAction[action] = count
		sum.Total += count
	}
	_ = rows.Close()
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating action rows: %w", err)
	}

	rows, err = s.db.Query("SELECT tier, COUNT(*) FROM events GROUP BY tier")
	if err != nil {
		return nil, fmt.Errorf("querying tiers: %w", err)
	}
	for rows.Next() {
		var tier, count int
		if err := rows.Scan(&tier, &count); err != nil {
			_ = rows.Close()
			return nil, fmt.Errorf("scanning tier row: %w", err)
		}
		sum.ByTier[tier] = count
	}
	_ = rows.Close()
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating tier rows: %w", err)
	}

	rows, err = s.db.Query(`SELECT tool_input, COUNT(*) as c FROM events
		WHERE tool_name = 'shell' GROUP BY tool_input ORDER BY c DESC LIMIT 5`)
	if err != nil {
		return nil, fmt.Errorf("querying top commands: %w", err)
	}
	for rows.Next() {
		var inputJSON string
		var count int
		if err := rows.Scan(&inputJSON, &count); err != nil {
			_ = rows.Close()
			return nil, fmt.Errorf("scanning command row: %w", err)
		}
		var input map[string]any
		if err := json.Unmarshal([]byte(inputJSON), &input); err == nil {
			if cmd, ok := input["command"].(string); ok {
				sum.TopCommands = append(sum.TopCommands, CommandCount{Command: cmd, Count: count})
			}
		}
	}
	_ = rows.Close()
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating command rows: %w", err)
	}

	return sum, nil
}

func Session() string {
	cwd, err := os.Getwd()
	if err != nil {
		return "unknown"
	}
	h := sha256.Sum256([]byte(cwd))
	return hex.EncodeToString(h[:])
}
