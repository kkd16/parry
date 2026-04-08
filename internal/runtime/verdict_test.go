package runtime

import (
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/kkd16/parry/internal/policy"
)

func TestResolveVerdict(t *testing.T) {
	tests := []struct {
		name             string
		mode             string
		action           policy.Action
		checkModeConfirm policy.Action
		want             Verdict
	}{
		{"observe mode allow", "observe", policy.Allow, policy.Block, Verdict{Action: "observe", Respond: "allow"}},
		{"observe mode block", "observe", policy.Block, policy.Block, Verdict{Action: "observe", Respond: "allow"}},
		{"observe mode confirm", "observe", policy.Confirm, policy.Block, Verdict{Action: "observe", Respond: "allow"}},
		{"enforce allow", "enforce", policy.Allow, policy.Block, Verdict{Action: "allow", Respond: "allow"}},
		{"enforce block", "enforce", policy.Block, policy.Block, Verdict{Action: "block", Respond: "deny", Message: "Blocked by Parry"}},
		{"enforce confirm fallback to allow", "enforce", policy.Confirm, policy.Allow, Verdict{Action: "allow", Respond: "allow"}},
		{"enforce confirm fallback to block", "enforce", policy.Confirm, policy.Block, Verdict{Action: "block", Respond: "deny", Message: "Blocked by Parry"}},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			p := &policy.Policy{Mode: tc.mode, CheckModeConfirm: tc.checkModeConfirm}
			got := resolveVerdict(p, tc.action)
			if diff := cmp.Diff(tc.want, got); diff != "" {
				t.Fatalf("resolveVerdict mismatch (-want +got):\n%s", diff)
			}
		})
	}
}
