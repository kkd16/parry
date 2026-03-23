package store

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
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

// Store wraps a SQLite database for audit logging.
type Store struct {
	db *sql.DB
}

// Event represents a single tool call decision to record.
type Event struct {
	ToolName  string
	ToolInput map[string]any
	Tier      int
	Action    string
	Session   string
	Mode      string
}

// Open creates or opens a SQLite database at dbPath, configures WAL mode,
// and ensures the schema exists.
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
			db.Close()
			return nil, fmt.Errorf("setting %s: %w", pragma, err)
		}
	}

	if _, err := db.Exec(schema); err != nil {
		db.Close()
		return nil, fmt.Errorf("initializing schema: %w", err)
	}

	return &Store{db: db}, nil
}

// RecordEvent inserts an audit log entry.
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

// Close closes the database connection.
func (s *Store) Close() error {
	return s.db.Close()
}

// Summary holds aggregate counts from the events table.
type Summary struct {
	Total        int
	ByAction     map[string]int
	ByTier       map[int]int
	TopCommands  []CommandCount
}

// CommandCount pairs a command with how many times it appeared.
type CommandCount struct {
	Command string
	Count   int
}

// Report queries the events table and returns a summary.
func (s *Store) Report() (*Summary, error) {
	sum := &Summary{
		ByAction: make(map[string]int),
		ByTier:   make(map[int]int),
	}

	// Total + by action.
	rows, err := s.db.Query("SELECT action, COUNT(*) FROM events GROUP BY action")
	if err != nil {
		return nil, fmt.Errorf("querying actions: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var action string
		var count int
		if err := rows.Scan(&action, &count); err != nil {
			return nil, fmt.Errorf("scanning action row: %w", err)
		}
		sum.ByAction[action] = count
		sum.Total += count
	}

	// By tier.
	rows, err = s.db.Query("SELECT tier, COUNT(*) FROM events GROUP BY tier")
	if err != nil {
		return nil, fmt.Errorf("querying tiers: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var tier, count int
		if err := rows.Scan(&tier, &count); err != nil {
			return nil, fmt.Errorf("scanning tier row: %w", err)
		}
		sum.ByTier[tier] = count
	}

	// Top commands.
	rows, err = s.db.Query(`SELECT tool_input, COUNT(*) as c FROM events
		WHERE tool_name = 'shell' GROUP BY tool_input ORDER BY c DESC LIMIT 5`)
	if err != nil {
		return nil, fmt.Errorf("querying top commands: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var inputJSON string
		var count int
		if err := rows.Scan(&inputJSON, &count); err != nil {
			return nil, fmt.Errorf("scanning command row: %w", err)
		}
		var input map[string]any
		if err := json.Unmarshal([]byte(inputJSON), &input); err == nil {
			if cmd, ok := input["command"].(string); ok {
				sum.TopCommands = append(sum.TopCommands, CommandCount{Command: cmd, Count: count})
			}
		}
	}

	return sum, nil
}

// Session returns a short SHA256 hash of the current working directory.
func Session() string {
	cwd, err := os.Getwd()
	if err != nil {
		return "unknown"
	}
	h := sha256.Sum256([]byte(cwd))
	return hex.EncodeToString(h[:8])
}
