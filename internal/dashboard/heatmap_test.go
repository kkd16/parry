package dashboard

import (
	"testing"

	"github.com/kkd16/parry/internal/store"
	"github.com/stretchr/testify/require"
)

func TestHandleHeatmap(t *testing.T) {
	t.Run("empty db returns empty projects array", func(t *testing.T) {
		srv := newTestServer(t)
		rec, body := doJSON(t, srv.routes(), "GET", "/api/heatmap")
		require.Equal(t, 200, rec.Code)
		require.Len(t, requireJSONArray(t, body, "projects"), 0)
	})

	t.Run("events across two workdirs", func(t *testing.T) {
		srv := newTestServer(t)
		seedEvents(t, srv.store,
			store.Event{ToolName: "Edit", Action: "allow", File: "a.go", Workdir: "/proj/one"},
			store.Event{ToolName: "Edit", Action: "allow", File: "a.go", Workdir: "/proj/one"},
			store.Event{ToolName: "Edit", Action: "allow", File: "b.go", Workdir: "/proj/one"},
			store.Event{ToolName: "Edit", Action: "allow", File: "x.go", Workdir: "/proj/two"},
		)

		_, body := doJSON(t, srv.routes(), "GET", "/api/heatmap")
		projects := requireJSONArray(t, body, "projects")
		require.Len(t, projects, 2)

		byWorkdir := map[string]map[string]any{}
		for _, p := range projects {
			pm := p.(map[string]any)
			byWorkdir[pm["workdir"].(string)] = pm
		}

		one := byWorkdir["/proj/one"]
		require.NotNil(t, one)
		require.Equal(t, float64(3), one["total"])
		oneFiles := one["files"].([]any)
		require.Len(t, oneFiles, 2)

		two := byWorkdir["/proj/two"]
		require.NotNil(t, two)
		require.Equal(t, float64(1), two["total"])
		twoFiles := two["files"].([]any)
		require.Len(t, twoFiles, 1)
	})
}
