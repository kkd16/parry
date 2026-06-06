package policy

import (
	"fmt"

	"github.com/kkd16/parry/internal/check"
)

func (e *Engine) Evaluate(tool check.CanonicalTool, toolInput map[string]any) (Action, error) {
	if e.policy == nil {
		return Block, fmt.Errorf("no policy loaded")
	}
	return e.policy.Explain(tool, toolInput).Action, nil
}
