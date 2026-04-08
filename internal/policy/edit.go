package policy

import (
	"fmt"
	"os"
	"regexp"
	"strings"
)

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

func SetProvider(path, provider string) error {
	return SetNotificationProvider(path, provider, nil)
}
