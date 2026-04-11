package store_test

import (
	"path/filepath"
	"testing"

	"github.com/kkd16/parry/internal/check"
	"github.com/kkd16/parry/internal/store"
	"github.com/stretchr/testify/require"
)

type eventOpt func(*store.Event)

func openTempStore(tb testing.TB) *store.Store {
	tb.Helper()
	path := filepath.Join(tb.TempDir(), "test.db")
	s, err := store.Open(path)
	require.NoError(tb, err)
	tb.Cleanup(func() { _ = s.Close() })
	return s
}

func seedEvent(tb testing.TB, s *store.Store, e store.Event) {
	tb.Helper()
	require.NoError(tb, s.RecordEvent(e))
}

func seedN(tb testing.TB, s *store.Store, n int, opts ...eventOpt) {
	tb.Helper()
	for i := 0; i < n; i++ {
		seedEvent(tb, s, makeEvent(opts...))
	}
}

func makeEvent(opts ...eventOpt) store.Event {
	e := store.Event{
		ToolName:  string(check.ToolShell),
		Action:    "allow",
		Session:   "sess-default",
		Mode:      "enforce",
		ToolInput: map[string]any{},
	}
	for _, opt := range opts {
		opt(&e)
	}
	return e
}

func listAll(tb testing.TB, s *store.Store) []store.EventRow {
	tb.Helper()
	rows, _, err := s.ListEvents(100, 0, 0, "", "", "", "", "")
	require.NoError(tb, err)
	return rows
}

func withBinary(b string) eventOpt   { return func(e *store.Event) { e.Binary = b } }
func withAction(a string) eventOpt   { return func(e *store.Event) { e.Action = a } }
func withSession(s string) eventOpt  { return func(e *store.Event) { e.Session = s } }
func withWorkdir(w string) eventOpt  { return func(e *store.Event) { e.Workdir = w } }
func withFile(f string) eventOpt     { return func(e *store.Event) { e.File = f } }
func withToolName(t string) eventOpt { return func(e *store.Event) { e.ToolName = t } }
func withRawName(r string) eventOpt  { return func(e *store.Event) { e.RawName = r } }
func withMode(m string) eventOpt     { return func(e *store.Event) { e.Mode = m } }
func withToolInput(in map[string]any) eventOpt {
	return func(e *store.Event) { e.ToolInput = in }
}
