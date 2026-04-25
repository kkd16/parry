package policy

import (
	"path/filepath"
	"strings"
)

func (p *Policy) AllProtectedPaths() []string {
	all := make([]string, 0, len(p.ParryPaths)+len(p.ProtectedPaths))
	all = append(all, p.ParryPaths...)
	all = append(all, p.ProtectedPaths...)
	return all
}

func (p *Policy) AnyPathProtected(paths []string) bool {
	for _, path := range paths {
		base := filepath.Base(path)
		isGlob := containsGlobMeta(path)
		for _, pattern := range p.AllProtectedPaths() {
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

func (e *Engine) anyPathProtected(paths []string) bool {
	return e.policy.AnyPathProtected(paths)
}

func containsGlobMeta(path string) bool {
	return strings.ContainsAny(path, "*?[")
}
