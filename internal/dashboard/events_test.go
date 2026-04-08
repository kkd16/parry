package dashboard

import (
	"testing"

	"github.com/kkd16/parry/internal/store"
	"github.com/stretchr/testify/require"
)

func TestHandleEvents(t *testing.T) {
	fixture := []store.Event{
		{ToolName: "Bash", Action: "allow", Binary: "ls", ToolInput: map[string]any{"command": "ls -la"}},
		{ToolName: "Bash", Action: "block", Binary: "rm", ToolInput: map[string]any{"command": "rm -rf /"}},
		{ToolName: "Edit", Action: "confirm", File: "/tmp/x.go", ToolInput: map[string]any{"path": "/tmp/x.go"}},
	}

	tests := []struct {
		name        string
		seed        []store.Event
		target      string
		wantLen     int
		wantTotal   float64
		wantLimit   float64
		wantOffset  float64
		checkEvents func(t *testing.T, events []any)
	}{
		{
			name:       "empty db returns empty array not null",
			seed:       nil,
			target:     "/api/events",
			wantLen:    0,
			wantTotal:  0,
			wantLimit:  100,
			wantOffset: 0,
		},
		{
			name:       "three events no filters",
			seed:       fixture,
			target:     "/api/events",
			wantLen:    3,
			wantTotal:  3,
			wantLimit:  100,
			wantOffset: 0,
		},
		{
			name:       "filter by action block",
			seed:       fixture,
			target:     "/api/events?action=block",
			wantLen:    1,
			wantTotal:  1,
			wantLimit:  100,
			wantOffset: 0,
			checkEvents: func(t *testing.T, events []any) {
				require.Equal(t, "block", events[0].(map[string]any)["action"])
			},
		},
		{
			name:       "filter by tool Bash",
			seed:       fixture,
			target:     "/api/events?tool=Bash",
			wantLen:    2,
			wantTotal:  2,
			wantLimit:  100,
			wantOffset: 0,
		},
		{
			name:       "limit and offset paginate",
			seed:       fixture,
			target:     "/api/events?limit=1&offset=1",
			wantLen:    1,
			wantTotal:  3,
			wantLimit:  1,
			wantOffset: 1,
		},
		{
			name:       "invalid limit falls back to default",
			seed:       fixture,
			target:     "/api/events?limit=abc",
			wantLen:    3,
			wantTotal:  3,
			wantLimit:  100,
			wantOffset: 0,
		},
		{
			name:       "limit over max clamps to 1000",
			seed:       fixture,
			target:     "/api/events?limit=99999",
			wantLen:    3,
			wantTotal:  3,
			wantLimit:  1000,
			wantOffset: 0,
		},
		{
			name:       "search matches tool name",
			seed:       fixture,
			target:     "/api/events?search=Edit",
			wantLen:    1,
			wantTotal:  1,
			wantLimit:  100,
			wantOffset: 0,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			srv := newTestServer(t)
			seedEvents(t, srv.store, tc.seed...)
			rec, body := doJSON(t, srv.routes(), "GET", tc.target)
			require.Equal(t, 200, rec.Code)

			events := requireJSONArray(t, body, "events")
			require.Len(t, events, tc.wantLen)
			require.Equal(t, tc.wantTotal, body["total"])
			require.Equal(t, tc.wantLimit, body["limit"])
			require.Equal(t, tc.wantOffset, body["offset"])
			if tc.checkEvents != nil {
				tc.checkEvents(t, events)
			}
		})
	}
}

func TestHandleEventsSinceID(t *testing.T) {
	srv := newTestServer(t)
	seedEvents(t, srv.store,
		store.Event{ToolName: "Bash", Action: "allow", Binary: "a"},
		store.Event{ToolName: "Bash", Action: "allow", Binary: "b"},
		store.Event{ToolName: "Bash", Action: "allow", Binary: "c"},
	)

	_, body := doJSON(t, srv.routes(), "GET", "/api/events?since_id=1")
	events := requireJSONArray(t, body, "events")
	require.Len(t, events, 2)
	for _, e := range events {
		id := e.(map[string]any)["id"].(float64)
		require.Greater(t, id, float64(1))
	}
}
