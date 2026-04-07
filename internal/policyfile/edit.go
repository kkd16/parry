// Package policyfile provides targeted, line-level edits to a policy YAML
// file. It is separate from internal/policy to avoid an import cycle with
// internal/notify (which policy uses for validation).
package policyfile

import (
	"fmt"
	"os"
	"regexp"
	"strings"
)

// SetMode rewrites the top-level `mode:` field in a policy YAML file.
func SetMode(path, mode string) error {
	data, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("reading policy: %w", err)
	}

	lines := strings.Split(string(data), "\n")
	found := false
	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "mode:") {
			indent := line[:len(line)-len(strings.TrimLeft(line, " \t"))]
			lines[i] = indent + "mode: " + mode
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("could not find mode field in policy.yaml")
	}

	if err := os.WriteFile(path, []byte(strings.Join(lines, "\n")), 0o644); err != nil {
		return fmt.Errorf("writing policy: %w", err)
	}
	return nil
}

// SetNotificationProvider rewrites the notifications.provider field and any
// provider-specific subfields passed in providerCfg. Only leaf string fields
// indented 4 spaces deep are rewritten; unknown keys are ignored.
func SetNotificationProvider(path, provider string, providerCfg map[string]string) error {
	raw, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("reading policy: %w", err)
	}
	s := string(raw)
	s = regexp.MustCompile(`(?m)^(  provider:).*`).ReplaceAllString(s, "${1} "+provider)
	for k, v := range providerCfg {
		re := regexp.MustCompile(`(?m)^(    ` + regexp.QuoteMeta(k) + `:).*`)
		s = re.ReplaceAllString(s, "${1} "+v)
	}
	if err := os.WriteFile(path, []byte(s), 0o644); err != nil {
		return fmt.Errorf("writing policy: %w", err)
	}
	return nil
}

// SetProvider rewrites only the provider field, leaving any existing
// provider-specific config untouched.
func SetProvider(path, provider string) error {
	return SetNotificationProvider(path, provider, nil)
}
