package policy

import (
	"path/filepath"
	"strings"
)

func (e *Engine) allProtectedPaths() []string {
	all := make([]string, 0, len(e.policy.ParryPaths)+len(e.policy.ProtectedPaths))
	all = append(all, e.policy.ParryPaths...)
	all = append(all, e.policy.ProtectedPaths...)
	return all
}

func (e *Engine) anyPathProtected(paths []string) bool {
	for _, path := range paths {
		base := filepath.Base(path)
		isGlob := containsGlobMeta(path)
		for _, pattern := range e.allProtectedPaths() {
			if matched, _ := filepath.Match(pattern, path); matched {
				return true
			}
			if dir, ok := strings.CutSuffix(pattern, "/*"); ok {
				if strings.HasPrefix(path, dir+"/") {
					return true
				}
			}
			if !strings.Contains(pattern, "/") {
				if matched, _ := filepath.Match(pattern, base); matched {
					return true
				}
			}
			if isGlob {
				patternBase := filepath.Base(pattern)
				if matched, _ := filepath.Match(path, pattern); matched {
					return true
				}
				if !strings.Contains(pattern, "/") {
					if matched, _ := filepath.Match(base, patternBase); matched {
						return true
					}
				}
			}
		}
	}
	return false
}

func containsGlobMeta(path string) bool {
	return strings.ContainsAny(path, "*?[")
}
