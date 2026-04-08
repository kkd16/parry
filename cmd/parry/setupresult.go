package main

import (
	"fmt"

	"github.com/kkd16/parry/internal/notify"
	"github.com/kkd16/parry/internal/ui"
)

// renderSetupResult prints a notify.SetupResult using the CLI UI helpers.
// Providers themselves return structured data and never import ui.
func renderSetupResult(r notify.SetupResult) {
	if r.TestErr != nil {
		ui.Warn(fmt.Sprintf("test failed: %v", r.TestErr))
		ui.Info("notifications configured, but verify your setup")
	} else if r.TestSent {
		ui.Success("test notification sent")
	}
	for _, kv := range r.Details {
		ui.Detail(kv[0], kv[1])
	}
	ui.Break()
	for _, line := range r.Instructions {
		ui.Info(line)
	}
	if len(r.Instructions) > 0 {
		ui.Break()
	}
}
