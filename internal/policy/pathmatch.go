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
	_, _, ok := p.FirstProtected(paths)
	return ok
}

func (p *Policy) FirstProtected(paths []string) (pattern, arg string, ok bool) {
	patterns := p.allPaths
	if patterns == nil {
		patterns = p.AllProtectedPaths()
	}
	for _, raw := range paths {
		path := p.expandTilde(raw)
		base := filepath.Base(path)
		isGlob := containsGlobMeta(path)
		for _, pat := range patterns {
			if matched, _ := filepath.Match(pat, path); matched {
				return pat, raw, true
			}
			if dir, cut := strings.CutSuffix(pat, "/*"); cut {
				if strings.HasPrefix(path, dir+"/") {
					return pat, raw, true
				}
			}
			if !strings.Contains(pat, "/") {
				if matched, _ := filepath.Match(pat, base); matched {
					return pat, raw, true
				}
			}
			if isGlob {
				patternBase := filepath.Base(pat)
				if matched, _ := filepath.Match(path, pat); matched {
					return pat, raw, true
				}
				if !strings.Contains(pat, "/") {
					if matched, _ := filepath.Match(base, patternBase); matched {
						return pat, raw, true
					}
				}
			}
		}
	}
	return "", "", false
}

func (p *Policy) expandTilde(path string) string {
	if p.home == "" {
		return path
	}
	if path == "~" {
		return p.home
	}
	if strings.HasPrefix(path, "~/") {
		return p.home + path[1:]
	}
	return path
}

func containsGlobMeta(path string) bool {
	return strings.ContainsAny(path, "*?[")
}
