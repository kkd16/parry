package runtime

import (
	"fmt"
	"os"

	"github.com/kkd16/parry/internal/check"
	"github.com/kkd16/parry/internal/store"
)

func (e *Engine) record(tc *check.ToolCall, action, mode string) {
	s, err := e.openStore()
	if err != nil {
		fmt.Fprintf(os.Stderr, "parry: db: %v\n", err)
		return
	}
	defer func() { _ = s.Close() }()
	if err := s.RecordEvent(store.NewEvent(tc, action, mode)); err != nil {
		fmt.Fprintf(os.Stderr, "parry: db: %v\n", err)
	}
}
