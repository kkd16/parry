package notify

// SetupResult is the outcome of a provider's RunSetup. It contains structured
// data the caller renders itself — the notify package no longer talks to the
// terminal UI directly.
type SetupResult struct {
	Provider     string
	Details      [][2]string // key/value lines, e.g. topic -> ntfy.sh
	Instructions []string    // free-form follow-up steps
	TestSent     bool        // true if the test notification was sent
	TestErr      error       // non-nil if the test failed (setup still succeeded)
}
