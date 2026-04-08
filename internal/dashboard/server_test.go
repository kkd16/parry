package dashboard

import (
	"bytes"
	"log"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNewServer(t *testing.T) {
	dbPath := filepath.Join(t.TempDir(), "parry.db")
	srv, err := New(dbPath, ":0")
	require.NoError(t, err)
	require.NotNil(t, srv)
	require.NoError(t, srv.Close())
}

func TestNewServerBadDB(t *testing.T) {
	_, err := New("/nonexistent/dir/parry.db", ":0")
	require.Error(t, err)
	require.Contains(t, err.Error(), "opening database")
}

func TestLogMiddleware(t *testing.T) {
	var buf bytes.Buffer
	srv := &Server{logger: log.New(&buf, "", 0)}

	stub := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(418)
		_, _ = w.Write([]byte("teapot"))
	})

	req := httptest.NewRequest("GET", "/api/test?x=1", nil)
	rec := httptest.NewRecorder()
	srv.logMiddleware(stub).ServeHTTP(rec, req)

	require.Equal(t, 418, rec.Code)
	logged := buf.String()
	require.True(t, strings.Contains(logged, "GET"), "log %q should contain GET", logged)
	require.True(t, strings.Contains(logged, "/api/test?x=1"), "log %q should contain path with query", logged)
	require.True(t, strings.Contains(logged, "418"), "log %q should contain status 418", logged)
}
