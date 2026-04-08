package dashboard

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestHandleAbout(t *testing.T) {
	srv := newTestServer(t)
	rec, body := doJSON(t, srv.routes(), "GET", "/api/about")
	require.Equal(t, 200, rec.Code)
	for _, key := range []string{"version", "go_version", "commit", "built", "platform", "data_dir"} {
		_, ok := body[key]
		require.True(t, ok, "response should contain key %q", key)
	}
	require.NotEmpty(t, body["go_version"])
	require.NotEmpty(t, body["platform"])
}
