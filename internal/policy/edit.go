package policy

import (
	"fmt"
	"os"
	"regexp"
)

var modeLineRE = regexp.MustCompile(`(?m)^(\s*mode:).*`)
var providerLineRE = regexp.MustCompile(`(?m)^(  provider:).*`)

func SetMode(path, mode string) error {
	return rewriteFile(path, func(src string) (string, error) {
		out, n := replaceWithCount(modeLineRE, src, "${1} "+mode)
		if n == 0 {
			return "", fmt.Errorf("could not find mode field in policy.yaml")
		}
		return out, nil
	})
}

func SetNotificationProvider(path, provider string, providerCfg map[string]string) error {
	return rewriteFile(path, func(src string) (string, error) {
		src = providerLineRE.ReplaceAllString(src, "${1} "+provider)
		for k, v := range providerCfg {
			re := regexp.MustCompile(`(?m)^(    ` + regexp.QuoteMeta(k) + `:).*`)
			src = re.ReplaceAllString(src, "${1} "+v)
		}
		return src, nil
	})
}

func rewriteFile(path string, fn func(string) (string, error)) error {
	raw, err := os.ReadFile(path)
	if err != nil {
		return fmt.Errorf("reading policy: %w", err)
	}
	out, err := fn(string(raw))
	if err != nil {
		return err
	}
	if err := os.WriteFile(path, []byte(out), 0o644); err != nil {
		return fmt.Errorf("writing policy: %w", err)
	}
	return nil
}

func replaceWithCount(re *regexp.Regexp, src, repl string) (string, int) {
	n := 0
	out := re.ReplaceAllStringFunc(src, func(match string) string {
		n++
		return re.ReplaceAllString(match, repl)
	})
	return out, n
}
