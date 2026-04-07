package runtime

import "github.com/kkd16/parry/internal/policy"

type Verdict struct {
	Action  string
	Respond string
	Message string
}

func resolveVerdict(p *policy.Policy, action policy.Action) Verdict {
	if p.Mode == "observe" {
		return Verdict{"observe", "allow", ""}
	}
	switch action {
	case policy.Allow:
		return Verdict{"allow", "allow", ""}
	case policy.Confirm:
		return resolveVerdict(p, p.CheckModeConfirm)
	default:
		return Verdict{"block", "deny", "Blocked by Parry"}
	}
}
