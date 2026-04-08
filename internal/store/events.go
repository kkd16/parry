package store

import (
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/kkd16/parry/internal/check"
	"github.com/kkd16/parry/internal/shellparse"
)

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

func NewEvent(tc *check.ToolCall, action, mode string) Event {
	e := Event{
		ToolName:  string(tc.Tool),
		ToolInput: tc.ToolInput,
		Action:    action,
		Session:   Session(),
		Mode:      mode,
		RawName:   tc.RawName,
		Workdir:   Workdir(),
	}
	if cmd, ok := tc.ToolInput["command"].(string); ok && cmd != "" {
		cmds := shellparse.Parse(cmd)
		if len(cmds) > 0 {
			e.Binary = cmds[0].Binary
			e.Subcommand = cmds[0].Subcommand
		}
	}
	if p, ok := tc.ToolInput["path"].(string); ok {
		e.File = p
	}
	return e
}

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
