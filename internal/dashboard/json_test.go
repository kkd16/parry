package dashboard

import (
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/kkd16/parry/internal/store"
	"github.com/stretchr/testify/require"
)

type leaf struct {
	Items []string `json:"items"`
}

type branch struct {
	Name   string         `json:"name"`
	Tags   []string       `json:"tags"`
	Meta   map[string]int `json:"meta"`
	Leaf   leaf           `json:"leaf"`
	Leaves []leaf         `json:"leaves"`
	Child  *leaf          `json:"child"`
}

func TestNormalizeForJSON(t *testing.T) {
	tests := []struct {
		name string
		in   any
		want string
	}{
		{
			name: "nil slice field in struct",
			in:   leaf{},
			want: `{"items":[]}`,
		},
		{
			name: "nil map and nil slice in struct",
			in:   branch{Name: "root"},
			want: `{"name":"root","tags":[],"meta":{},"leaf":{"items":[]},"leaves":[],"child":null}`,
		},
		{
			name: "nested struct with nil slice two levels deep",
			in:   branch{Name: "root", Leaf: leaf{}},
			want: `{"name":"root","tags":[],"meta":{},"leaf":{"items":[]},"leaves":[],"child":null}`,
		},
		{
			name: "slice of structs each with nil slice",
			in:   branch{Name: "r", Leaves: []leaf{{}, {}}},
			want: `{"name":"r","tags":[],"meta":{},"leaf":{"items":[]},"leaves":[{"items":[]},{"items":[]}],"child":null}`,
		},
		{
			name: "pointer to struct with nil slice",
			in:   branch{Name: "r", Child: &leaf{}},
			want: `{"name":"r","tags":[],"meta":{},"leaf":{"items":[]},"leaves":[],"child":{"items":[]}}`,
		},
		{
			name: "map string any mirrors heatmap handler shape",
			in:   map[string]any{"projects": []*leaf(nil)},
			want: `{"projects":[]}`,
		},
		{
			name: "populated values are untouched",
			in:   leaf{Items: []string{"a", "b"}},
			want: `{"items":["a","b"]}`,
		},
		{
			name: "populated map untouched",
			in:   branch{Name: "r", Meta: map[string]int{"x": 1}},
			want: `{"name":"r","tags":[],"meta":{"x":1},"leaf":{"items":[]},"leaves":[],"child":null}`,
		},
		{
			name: "primitive int unchanged",
			in:   42,
			want: `42`,
		},
		{
			name: "primitive string unchanged",
			in:   "hello",
			want: `"hello"`,
		},
		{
			name: "nil input stays null",
			in:   nil,
			want: `null`,
		},
		{
			name: "zero overview renders all slices as empty arrays",
			in:   store.Overview{},
			want: `{"total":0,"today":0,"last_7d":[],"by_action":[],"top_binaries":[],"recent_blocks":[]}`,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := json.Marshal(normalizeForJSON(tc.in))
			require.NoError(t, err)
			if diff := cmp.Diff(tc.want, string(got)); diff != "" {
				t.Fatalf("normalizeForJSON mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestIntParam(t *testing.T) {
	tests := []struct {
		name                      string
		in                        string
		fallback, min, max, want  int
	}{
		{"empty uses fallback", "", 100, 1, 1000, 100},
		{"non numeric uses fallback", "abc", 50, 0, 999, 50},
		{"below min clamps up", "-5", 100, 1, 1000, 1},
		{"above max clamps down", "99999", 100, 1, 1000, 1000},
		{"in range kept", "42", 100, 1, 1000, 42},
		{"exactly min", "1", 100, 1, 1000, 1},
		{"exactly max", "1000", 100, 1, 1000, 1000},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.want, intParam(tc.in, tc.fallback, tc.min, tc.max))
		})
	}
}

func TestWriteJSON(t *testing.T) {
	rec := httptest.NewRecorder()
	writeJSON(rec, 418, leaf{})
	require.Equal(t, 418, rec.Code)
	require.Equal(t, "application/json", rec.Header().Get("Content-Type"))
	require.True(t, strings.Contains(rec.Body.String(), `"items":[]`))
	require.False(t, strings.Contains(rec.Body.String(), "null"))
}
