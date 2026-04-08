package runtime

import (
	"testing"
	"time"

	"github.com/kkd16/parry/internal/policy"
	"github.com/kkd16/parry/internal/store"
	"github.com/stretchr/testify/require"
)

func seedRateLimitEvents(tb testing.TB, s *store.Store, n int, session string) {
	tb.Helper()
	for i := 0; i < n; i++ {
		require.NoError(tb, s.RecordEvent(store.Event{
			ToolName:  "shell",
			Action:    "allow",
			Mode:      "enforce",
			Session:   session,
			ToolInput: map[string]any{},
		}))
	}
}

func newRateLimitPolicy(max int, window string, onExceed policy.Action) *policy.Policy {
	return &policy.Policy{
		Mode: "enforce",
		RateLimit: &policy.RateLimit{
			Window:   window,
			Max:      max,
			OnExceed: onExceed,
		},
	}
}

func TestApplyRateLimit_UnderLimit(t *testing.T) {
	pinCwd(t)
	s := openStoreAt(t, tempDB(t))
	seedRateLimitEvents(t, s, 2, store.Session())

	in := Verdict{Action: "allow", Respond: "allow"}
	got := applyRateLimit(s, newRateLimitPolicy(5, "1m", policy.Block), in)
	require.Equal(t, in, got)
}

func TestApplyRateLimit_AtLimitBoundary(t *testing.T) {
	pinCwd(t)
	s := openStoreAt(t, tempDB(t))
	seedRateLimitEvents(t, s, 5, store.Session())

	got := applyRateLimit(s, newRateLimitPolicy(5, "1m", policy.Block), Verdict{Action: "allow", Respond: "allow"})
	require.Equal(t, "block", got.Action)
	require.Equal(t, "deny", got.Respond)
	require.Contains(t, got.Message, "Rate limit exceeded")
	require.Contains(t, got.Message, "5/5")
}

func TestApplyRateLimit_OverLimit(t *testing.T) {
	pinCwd(t)
	s := openStoreAt(t, tempDB(t))
	seedRateLimitEvents(t, s, 7, store.Session())

	got := applyRateLimit(s, newRateLimitPolicy(5, "1m", policy.Block), Verdict{Action: "allow", Respond: "allow"})
	require.Equal(t, "block", got.Action)
	require.Contains(t, got.Message, "7/5")
}

func TestApplyRateLimit_OnExceedVariants(t *testing.T) {
	tests := []struct {
		name     string
		onExceed policy.Action
		wantAct  string
	}{
		{"on exceed block", policy.Block, "block"},
		{"on exceed confirm", policy.Confirm, "confirm"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			pinCwd(t)
			s := openStoreAt(t, tempDB(t))
			seedRateLimitEvents(t, s, 5, store.Session())

			got := applyRateLimit(s, newRateLimitPolicy(5, "1m", tc.onExceed), Verdict{Action: "allow", Respond: "allow"})
			require.Equal(t, tc.wantAct, got.Action)
			require.Equal(t, "deny", got.Respond)
		})
	}
}

func TestApplyRateLimit_DifferentSessionDoesNotCount(t *testing.T) {
	pinCwd(t)
	s := openStoreAt(t, tempDB(t))
	seedRateLimitEvents(t, s, 10, "some-other-session")

	in := Verdict{Action: "allow", Respond: "allow"}
	got := applyRateLimit(s, newRateLimitPolicy(5, "1m", policy.Block), in)
	require.Equal(t, in, got)
}

func TestApplyRateLimit_OutsideWindowDoesNotCount(t *testing.T) {
	pinCwd(t)
	s := openStoreAt(t, tempDB(t))
	seedRateLimitEvents(t, s, 5, store.Session())

	time.Sleep(2500 * time.Millisecond)

	in := Verdict{Action: "allow", Respond: "allow"}
	got := applyRateLimit(s, newRateLimitPolicy(5, "1s", policy.Block), in)
	require.Equal(t, in, got)
}
