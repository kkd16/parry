package agents

import (
	"github.com/kkd16/parry/internal/check"
	"github.com/kkd16/parry/internal/setup"
)

func Register() {
	check.Register(claudeAgent)
	setup.Register(claudeConfigurer)
	check.Register(cursorAgent)
	setup.Register(cursorConfigurer)
}
