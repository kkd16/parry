package runtime

import (
	"context"
	"fmt"

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

func (e *Engine) Policy() *policy.Policy { return e.policy.Policy() }

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

	if v.Respond != "deny" && p.RateLimit != nil && p.Mode == "enforce" {
		v = e.applyRateLimit(p, v)
	}

	e.record(tc, v.Action, p.Mode)
	return v
}

func (e *Engine) openStore() (*store.Store, error) {
	if e.dbPath == "" {
		return nil, fmt.Errorf("no db path configured")
	}
	return store.Open(e.dbPath)
}

