// Package agents wires known agent integrations (Claude Code, Cursor) into
// the check and setup registries. Callers invoke Register explicitly rather
// than relying on a blank-import init() side effect.
package agents

import (
	"github.com/kkd16/parry/internal/check"
	"github.com/kkd16/parry/internal/setup"
)

// Register installs every known agent into the shared check and setup
// registries. Safe to call multiple times — registration is idempotent per
// agent name.
func Register() {
	check.Register(claudeAgent)
	setup.Register(claudeConfigurer)
	check.Register(cursorAgent)
	setup.Register(cursorConfigurer)
}
