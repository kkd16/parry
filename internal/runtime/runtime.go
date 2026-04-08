package runtime

import (
	"context"
	"fmt"
	"os"

	"github.com/kkd16/parry/internal/check"
	"github.com/kkd16/parry/internal/policy"
	"github.com/kkd16/parry/internal/store"
)

type Engine struct {
	policy *policy.Engine
	dbPath string
}

func New(pol *policy.Engine, dbPath string) *Engine {
	return &Engine{policy: pol, dbPath: dbPath}
}

func (e *Engine) Decide(ctx context.Context, tc *check.ToolCall) Verdict {
	action, err := e.policy.Evaluate(tc.Tool, tc.ToolInput)
	if err != nil {
		return Verdict{Action: "block", Respond: "deny", Message: err.Error()}
	}
	p := e.policy.Policy()

	var v Verdict
	if action == policy.Confirm && p.NotificationsEnabled() && p.Mode == "enforce" {
		v = confirmViaNotify(ctx, p, tc)
	} else {
		v = resolveVerdict(p, action)
	}

	s, err := e.openStore()
	if err != nil {
		fmt.Fprintf(os.Stderr, "parry: db: %v\n", err)
		return v
	}
	defer func() { _ = s.Close() }()

	if v.Respond != "deny" && p.RateLimit != nil && p.Mode == "enforce" {
		v = applyRateLimit(s, p, v)
	}
	if err := s.RecordEvent(store.NewEvent(tc, v.Action, p.Mode)); err != nil {
		fmt.Fprintf(os.Stderr, "parry: db: %v\n", err)
	}
	return v
}

func (e *Engine) openStore() (*store.Store, error) {
	if e.dbPath == "" {
		return nil, fmt.Errorf("no db path configured")
	}
	return store.Open(e.dbPath)
}
