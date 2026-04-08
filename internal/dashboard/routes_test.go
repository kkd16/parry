package dashboard

import (
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestRoutes(t *testing.T) {
	srv := newTestServer(t)
	handler := srv.routes()

	tests := []struct {
		name         string
		target       string
		wantStatus   int
		wantBodySub  string
	}{
		{"root serves index", "/", 200, "<title>parry</title>"},
		{"static asset served directly", "/assets/app.js", 200, "console.log"},
		{"unknown spa route falls back to index", "/bridge", 200, "<title>parry</title>"},
		{"nested unknown spa route falls back to index", "/logbook/detail", 200, "<title>parry</title>"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", tc.target, nil)
			rec := httptest.NewRecorder()
			handler.ServeHTTP(rec, req)
			require.Equal(t, tc.wantStatus, rec.Code)
			require.True(t,
				strings.Contains(rec.Body.String(), tc.wantBodySub),
				"body %q should contain %q", rec.Body.String(), tc.wantBodySub,
			)
		})
	}
}
