package store_test

import (
	"testing"
	"time"

	"github.com/google/go-cmp/cmp"
	"github.com/kkd16/parry/internal/store"
	"github.com/stretchr/testify/require"
)

func TestRecordEvent_RoundTrip(t *testing.T) {
	s := openTempStore(t)
	in := makeEvent(
		withRawName("Bash"),
		withBinary("rm"),
		withWorkdir("/proj/a"),
		withSession("sess-1"),
		withAction("block"),
		withToolInput(map[string]any{"command": "rm -rf /"}),
	)

	before := time.Now().UTC().Truncate(time.Second)
	seedEvent(t, s, in)

	rows := listAll(t, s)
	require.Len(t, rows, 1)

	got := rows[0]
	require.Equal(t, in.ToolName, got.ToolName)
	require.Equal(t, in.RawName, got.RawName)
	require.Equal(t, in.Binary, got.Binary)
	require.Equal(t, in.Workdir, got.Workdir)
	require.Equal(t, in.Session, got.Session)
	require.Equal(t, in.Action, got.Action)
	require.Equal(t, in.Mode, got.Mode)
	if diff := cmp.Diff(in.ToolInput, got.ToolInput); diff != "" {
		t.Fatalf("ToolInput mismatch (-want +got):\n%s", diff)
	}

	ts, err := time.Parse(time.RFC3339, got.Timestamp)
	require.NoError(t, err)
	require.False(t, ts.Before(before), "timestamp %s before %s", ts, before)
	require.WithinDuration(t, time.Now().UTC(), ts, 2*time.Second)
}

func TestRecordEvent_NestedToolInput(t *testing.T) {
	s := openTempStore(t)
	in := makeEvent(
		withToolInput(map[string]any{
			"command": "ls",
			"opts":    map[string]any{"recursive": true, "depth": float64(3)},
		}),
	)
	seedEvent(t, s, in)

	rows := listAll(t, s)
	require.Len(t, rows, 1)
	if diff := cmp.Diff(in.ToolInput, rows[0].ToolInput); diff != "" {
		t.Fatalf("nested ToolInput mismatch (-want +got):\n%s", diff)
	}
}

func TestRecordEvent_PreservesEmptyFields(t *testing.T) {
	s := openTempStore(t)
	in := makeEvent(withMode("observe"), withSession("sess-x"))
	seedEvent(t, s, in)

	rows := listAll(t, s)
	require.Len(t, rows, 1)
	require.Equal(t, "", rows[0].RawName)
	require.Equal(t, "", rows[0].Binary)
	require.Equal(t, "", rows[0].File)
	require.Equal(t, "", rows[0].Workdir)
}

func TestCountSince(t *testing.T) {
	s := openTempStore(t)

	seedN(t, s, 5, withSession("session-A"))
	seedN(t, s, 3, withSession("session-B"))

	now := time.Now().UTC()

	a, err := s.CountSince("session-A", now.Add(-time.Minute))
	require.NoError(t, err)
	require.Equal(t, 5, a)

	b, err := s.CountSince("session-B", now.Add(-time.Minute))
	require.NoError(t, err)
	require.Equal(t, 3, b)

	c, err := s.CountSince("session-C", now.Add(-time.Minute))
	require.NoError(t, err)
	require.Equal(t, 0, c)
}

func TestListEvents_Filters(t *testing.T) {
	tests := []struct {
		name     string
		seed     []eventOpt
		seedMore [][]eventOpt
		limit    int
		offset   int
		sinceID  int
		action   string
		tool     string
		sortCol  string
		sortDir  string
		search   string
		wantLen  int
		wantTot  int
		assert   func(t *testing.T, rows []store.EventRow)
	}{
		{
			name:     "no filter",
			seedMore: [][]eventOpt{nil, nil, nil},
			limit:    100,
			wantLen:  3,
			wantTot:  3,
		},
		{
			name: "filter by action",
			seedMore: [][]eventOpt{
				{withAction("allow")},
				{withAction("block")},
				{withAction("block")},
			},
			limit:   100,
			action:  "block",
			wantLen: 2,
			wantTot: 2,
			assert: func(t *testing.T, rows []store.EventRow) {
				for _, r := range rows {
					require.Equal(t, "block", r.Action)
				}
			},
		},
		{
			name: "filter by tool",
			seedMore: [][]eventOpt{
				{withToolName("shell")},
				{withToolName("file_read")},
			},
			limit:   100,
			tool:    "shell",
			wantLen: 1,
			wantTot: 1,
			assert: func(t *testing.T, rows []store.EventRow) {
				require.Equal(t, "shell", rows[0].ToolName)
			},
		},
		{
			name:     "sinceID skips earlier rows",
			seedMore: [][]eventOpt{nil, nil, nil, nil, nil},
			limit:    100,
			sinceID:  2,
			wantLen:  3,
			wantTot:  3,
			assert: func(t *testing.T, rows []store.EventRow) {
				for _, r := range rows {
					require.Greater(t, r.ID, 2)
				}
			},
		},
		{
			name:     "limit caps result count",
			seedMore: [][]eventOpt{nil, nil, nil, nil, nil},
			limit:    2,
			wantLen:  2,
			wantTot:  5,
		},
		{
			name:     "offset skips first rows",
			seedMore: [][]eventOpt{nil, nil, nil, nil, nil},
			limit:    2,
			offset:   2,
			wantLen:  2,
			wantTot:  5,
		},
		{
			name: "search in tool_input",
			seedMore: [][]eventOpt{
				{withToolInput(map[string]any{"command": "rm /tmp/x"})},
				{withToolInput(map[string]any{"command": "ls -la"})},
			},
			limit:   100,
			search:  "rm",
			wantLen: 1,
			wantTot: 1,
		},
		{
			name: "search in tool_name",
			seedMore: [][]eventOpt{
				{withToolName("shell")},
				{withToolName("file_read")},
			},
			limit:   100,
			search:  "shell",
			wantLen: 1,
			wantTot: 1,
		},
		{
			name:     "sort timestamp asc",
			seedMore: [][]eventOpt{nil, nil, nil},
			limit:    100,
			sortCol:  "timestamp",
			sortDir:  "asc",
			wantLen:  3,
			wantTot:  3,
			assert: func(t *testing.T, rows []store.EventRow) {
				require.Less(t, rows[0].ID, rows[1].ID)
				require.Less(t, rows[1].ID, rows[2].ID)
			},
		},
		{
			name: "sort by binary desc",
			seedMore: [][]eventOpt{
				{withBinary("a")},
				{withBinary("b")},
				{withBinary("c")},
			},
			limit:   100,
			sortCol: "binary",
			sortDir: "desc",
			wantLen: 3,
			wantTot: 3,
			assert: func(t *testing.T, rows []store.EventRow) {
				require.Equal(t, "c", rows[0].Binary)
				require.Equal(t, "b", rows[1].Binary)
				require.Equal(t, "a", rows[2].Binary)
			},
		},
		{
			name:     "invalid sort col falls back to id desc",
			seedMore: [][]eventOpt{nil, nil, nil},
			limit:    100,
			sortCol:  "garbage",
			sortDir:  "asc",
			wantLen:  3,
			wantTot:  3,
			assert: func(t *testing.T, rows []store.EventRow) {
				require.Greater(t, rows[0].ID, rows[1].ID)
				require.Greater(t, rows[1].ID, rows[2].ID)
			},
		},
		{
			name: "combined action and tool filters",
			seedMore: [][]eventOpt{
				{withToolName("shell"), withAction("block")},
				{withToolName("shell"), withAction("allow")},
				{withToolName("file_read"), withAction("block")},
			},
			limit:   100,
			action:  "block",
			tool:    "shell",
			wantLen: 1,
			wantTot: 1,
			assert: func(t *testing.T, rows []store.EventRow) {
				require.Equal(t, "shell", rows[0].ToolName)
				require.Equal(t, "block", rows[0].Action)
			},
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			s := openTempStore(t)
			for _, opts := range tc.seedMore {
				seedEvent(t, s, makeEvent(opts...))
			}

			rows, total, err := s.ListEvents(tc.limit, tc.offset, tc.sinceID, tc.action, tc.tool, tc.sortCol, tc.sortDir, tc.search)
			require.NoError(t, err)
			require.Equal(t, tc.wantTot, total)
			require.Len(t, rows, tc.wantLen)
			if tc.assert != nil {
				tc.assert(t, rows)
			}
		})
	}
}
