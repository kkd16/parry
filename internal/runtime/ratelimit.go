package runtime

import (
	"fmt"
	"os"
	"time"

	"github.com/kkd16/parry/internal/policy"
	"github.com/kkd16/parry/internal/store"
)

func applyRateLimit(s *store.Store, p *policy.Policy, v Verdict) Verdict {
	window := p.RateLimit.ParseWindow()
	count, err := s.CountSince(store.Session(), time.Now().UTC().Add(-window))
	if err != nil {
		fmt.Fprintf(os.Stderr, "parry: db: %v\n", err)
		return v
	}
	if count >= p.RateLimit.Max {
		return Verdict{
			Action:  string(p.RateLimit.OnExceed),
			Respond: "deny",
			Message: fmt.Sprintf("Rate limit exceeded: %d/%d in %s", count, p.RateLimit.Max, p.RateLimit.Window),
		}
	}
	return v
}
