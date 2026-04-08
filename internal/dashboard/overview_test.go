package dashboard

import (
	"testing"

	"github.com/kkd16/parry/internal/store"
	"github.com/stretchr/testify/require"
)

func TestHandleOverview(t *testing.T) {
	t.Run("empty db renders all slices as empty arrays", func(t *testing.T) {
		srv := newTestServer(t)
		rec, body := doJSON(t, srv.routes(), "GET", "/api/overview")
		require.Equal(t, 200, rec.Code)
		require.Equal(t, float64(0), body["total"])
		require.Equal(t, float64(0), body["today"])

		last7d := requireJSONArray(t, body, "last_7d")
		require.Len(t, last7d, 7)
		for _, b := range last7d {
			require.Equal(t, float64(0), b.(map[string]any)["count"])
		}

		for _, key := range []string{"by_action", "top_binaries", "recent_blocks"} {
			require.Len(t, requireJSONArray(t, body, key), 0)
		}
	})

	t.Run("mixed events populate aggregates", func(t *testing.T) {
		srv := newTestServer(t)
		seedEvents(t, srv.store,
			store.Event{ToolName: "Bash", Action: "allow", Binary: "ls"},
			store.Event{ToolName: "Bash", Action: "allow", Binary: "ls"},
			store.Event{ToolName: "Bash", Action: "block", Binary: "rm"},
			store.Event{ToolName: "Bash", Action: "confirm", Binary: "git"},
		)
		_, body := doJSON(t, srv.routes(), "GET", "/api/overview")
		require.Equal(t, float64(4), body["total"])

		byAction := requireJSONArray(t, body, "by_action")
		require.NotEmpty(t, byAction)
		actionCounts := map[string]float64{}
		for _, a := range byAction {
			m := a.(map[string]any)
			actionCounts[m["action"].(string)] = m["count"].(float64)
		}
		require.Equal(t, float64(2), actionCounts["allow"])
		require.Equal(t, float64(1), actionCounts["block"])
		require.Equal(t, float64(1), actionCounts["confirm"])

		topBinaries := requireJSONArray(t, body, "top_binaries")
		require.NotEmpty(t, topBinaries)
		require.Equal(t, "ls", topBinaries[0].(map[string]any)["binary"])
		require.Equal(t, float64(2), topBinaries[0].(map[string]any)["count"])

		recentBlocks := requireJSONArray(t, body, "recent_blocks")
		require.Len(t, recentBlocks, 1)
	})

	t.Run("recent blocks capped at five", func(t *testing.T) {
		srv := newTestServer(t)
		var events []store.Event
		for range 8 {
			events = append(events, store.Event{ToolName: "Bash", Action: "block", Binary: "rm"})
		}
		seedEvents(t, srv.store, events...)

		_, body := doJSON(t, srv.routes(), "GET", "/api/overview")
		recentBlocks := requireJSONArray(t, body, "recent_blocks")
		require.Len(t, recentBlocks, 5)
	})
}
