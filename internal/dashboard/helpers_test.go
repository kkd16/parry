package dashboard

import (
	"encoding/json"
	"io/fs"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"testing"
	"testing/fstest"

	"github.com/kkd16/parry/internal/store"
	"github.com/stretchr/testify/require"
)

func newTestServer(t *testing.T) *Server {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "parry.db")
	st, err := store.Open(dbPath)
	require.NoError(t, err)
	t.Cleanup(func() { _ = st.Close() })

	frontend := fstest.MapFS{
		"index.html":   &fstest.MapFile{Data: []byte("<!doctype html><title>parry</title>")},
		"assets/app.js": &fstest.MapFile{Data: []byte("console.log('parry')")},
	}
	return &Server{store: st, frontend: fs.FS(frontend)}
}

func seedEvents(t *testing.T, s *store.Store, events ...store.Event) {
	t.Helper()
	for _, e := range events {
		if e.Session == "" {
			e.Session = "test-session"
		}
		require.NoError(t, s.RecordEvent(e))
	}
}

func requireJSONArray(t *testing.T, body map[string]any, key string) []any {
	t.Helper()
	arr, ok := body[key].([]any)
	require.True(t, ok, "field %q must be a JSON array, got %T", key, body[key])
	return arr
}

func doJSON(t *testing.T, h http.Handler, method, target string) (*httptest.ResponseRecorder, map[string]any) {
	t.Helper()
	req := httptest.NewRequest(method, target, nil)
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, req)
	require.Equal(t, "application/json", rec.Header().Get("Content-Type"))
	var body map[string]any
	require.NoError(t, json.Unmarshal(rec.Body.Bytes(), &body))
	return rec, body
}
