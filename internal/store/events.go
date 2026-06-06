package store

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/kkd16/parry/internal/check"
	"github.com/kkd16/parry/internal/shellparse"
)

type Event struct {
	ToolName    string
	ToolInput   map[string]any
	Action      string
	WouldAction string
	Session     string
	Mode        string
	RawName     string
	Binary      string
	File        string
	Workdir     string
}

type EventRow struct {
	ID          int            `json:"id"`
	Timestamp   string         `json:"timestamp"`
	ToolName    string         `json:"tool_name"`
	ToolInput   map[string]any `json:"tool_input"`
	Action      string         `json:"action"`
	WouldAction string         `json:"would_action"`
	Session     string         `json:"session"`
	Mode        string         `json:"mode"`
	RawName     string         `json:"raw_name"`
	Binary      string         `json:"binary"`
	File        string         `json:"file"`
	Workdir     string         `json:"workdir"`
}

func (ev EventRow) CanonicalTool() string {
	switch ev.ToolName {
	case string(check.ToolShell), string(check.ToolFileRead), string(check.ToolFileEdit):
		return ev.ToolName
	}
	if ev.Binary != "" {
		return string(check.ToolShell)
	}
	if _, ok := ev.ToolInput["command"].(string); ok {
		return string(check.ToolShell)
	}
	if ev.File != "" {
		return string(check.ToolFileEdit)
	}
	return ev.ToolName
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
		}
	}
	if p, ok := tc.ToolInput["path"].(string); ok {
		e.File = p
	}
	return e
}

var allowedSortCols = map[string]string{
	"timestamp":    "timestamp",
	"tool_name":    "tool_name",
	"action":       "action",
	"would_action": "would_action",
	"mode":         "mode",
	"raw_name":     "raw_name",
	"binary":       "binary",
	"file":         "file",
	"workdir":      "workdir",
}

func (s *Store) RecordEvent(e Event) error {
	inputJSON, err := json.Marshal(e.ToolInput)
	if err != nil {
		return fmt.Errorf("marshaling tool_input: %w", err)
	}

	_, err = s.db.Exec(
		`INSERT INTO events (timestamp, tool_name, tool_input, action, would_action, session, mode, raw_name, binary, file, workdir)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		time.Now().UTC().Format(time.RFC3339),
		e.ToolName,
		string(inputJSON),
		e.Action,
		e.WouldAction,
		e.Session,
		e.Mode,
		e.RawName,
		e.Binary,
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

func (s *Store) GetEvent(id int) (*EventRow, error) {
	row := s.db.QueryRow(
		`SELECT id, timestamp, tool_name, tool_input, action, would_action, session, mode, raw_name, binary, file, workdir
		 FROM events WHERE id = ?`,
		id,
	)
	ev, err := scanEvent(row)
	if err != nil {
		return nil, err
	}
	return &ev, nil
}

type EventQuery struct {
	Limit, Offset, SinceID int
	Action, Tool, Binary   string
	Session                string
	SortCol, SortOrder     string
	Search                 string
}

func (s *Store) ListEvents(q EventQuery) ([]EventRow, int, error) {
	where := ""
	var args []any

	if q.SinceID > 0 {
		where += " AND id > ?"
		args = append(args, q.SinceID)
	}
	if q.Action != "" {
		where += " AND (action = ? OR would_action = ?)"
		args = append(args, q.Action, q.Action)
	}
	if q.Tool != "" {
		where += " AND tool_name = ?"
		args = append(args, q.Tool)
	}
	if q.Binary != "" {
		where += " AND binary = ?"
		args = append(args, q.Binary)
	}
	if q.Session != "" {
		where += " AND session = ?"
		args = append(args, q.Session)
	}
	if q.Search != "" {
		where += " AND (tool_input LIKE ? OR tool_name LIKE ? OR session LIKE ?)"
		like := "%" + q.Search + "%"
		args = append(args, like, like, like)
	}

	var total int
	countQ := "SELECT COUNT(*) FROM events WHERE 1=1" + where
	if err := s.db.QueryRow(countQ, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("counting events: %w", err)
	}

	orderClause := "id DESC"
	if col, ok := allowedSortCols[q.SortCol]; ok {
		dir := "DESC"
		if q.SortOrder == "asc" {
			dir = "ASC"
		}
		orderClause = col + " " + dir + ", id " + dir
	}

	var query string
	var rowArgs []any
	if q.SinceID > 0 {
		query = "SELECT id, timestamp, tool_name, tool_input, action, would_action, session, mode, raw_name, binary, file, workdir FROM events WHERE 1=1" + where + " ORDER BY id ASC LIMIT ?"
		rowArgs = append(args, q.Limit)
	} else {
		query = "SELECT id, timestamp, tool_name, tool_input, action, would_action, session, mode, raw_name, binary, file, workdir FROM events WHERE 1=1" + where + " ORDER BY " + orderClause + " LIMIT ? OFFSET ?"
		rowArgs = append(args, q.Limit, q.Offset)
	}
	rows, err := s.db.Query(query, rowArgs...)
	if err != nil {
		return nil, 0, fmt.Errorf("querying events: %w", err)
	}
	defer func() { _ = rows.Close() }()

	var result []EventRow
	for rows.Next() {
		ev, err := scanEvent(rows)
		if err != nil {
			return nil, 0, err
		}
		result = append(result, ev)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("iterating events: %w", err)
	}

	return result, total, nil
}

type eventScanner interface {
	Scan(dest ...any) error
}

func scanEvent(scanner eventScanner) (EventRow, error) {
	var ev EventRow
	var inputJSON string
	if err := scanner.Scan(&ev.ID, &ev.Timestamp, &ev.ToolName, &inputJSON, &ev.Action, &ev.WouldAction, &ev.Session, &ev.Mode, &ev.RawName, &ev.Binary, &ev.File, &ev.Workdir); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return EventRow{}, err
		}
		return EventRow{}, fmt.Errorf("scanning event: %w", err)
	}
	if err := json.Unmarshal([]byte(inputJSON), &ev.ToolInput); err != nil {
		log.Printf("warning: malformed tool_input JSON for event %d: %v", ev.ID, err)
		ev.ToolInput = map[string]any{"raw": inputJSON}
	}
	return ev, nil
}
