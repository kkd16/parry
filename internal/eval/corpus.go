package eval

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/kkd16/parry/internal/check"
	"github.com/kkd16/parry/internal/policy"
	"go.yaml.in/yaml/v4"
)

type Entry struct {
	ID        string         `yaml:"id"`
	Category  string         `yaml:"category"`
	Tool      string         `yaml:"tool"`
	ToolInput map[string]any `yaml:"tool_input"`
	Expect    string         `yaml:"expect"`
	Notes     string         `yaml:"notes,omitempty"`

	SourceFile string `yaml:"-"`
}

func (e Entry) ExpectedAction() (policy.Action, error) {
	switch policy.Action(e.Expect) {
	case policy.Allow, policy.Block, policy.Confirm:
		return policy.Action(e.Expect), nil
	default:
		return "", fmt.Errorf("invalid expect %q (must be allow, block, or confirm)", e.Expect)
	}
}

func (e Entry) CanonicalTool() (check.CanonicalTool, error) {
	switch check.CanonicalTool(e.Tool) {
	case check.ToolShell, check.ToolFileEdit, check.ToolFileRead, check.ToolUnknown:
		return check.CanonicalTool(e.Tool), nil
	default:
		return "", fmt.Errorf("invalid tool %q (must be shell, file_edit, file_read, or unknown)", e.Tool)
	}
}

func Load(dir string) ([]Entry, error) {
	info, err := os.Stat(dir)
	if err != nil {
		return nil, fmt.Errorf("corpus dir %s: %w", dir, err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("corpus path %s is not a directory", dir)
	}

	var files []string
	err = filepath.WalkDir(dir, func(path string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		if ext := strings.ToLower(filepath.Ext(path)); ext == ".yaml" || ext == ".yml" {
			files = append(files, path)
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("walking corpus dir: %w", err)
	}
	sort.Strings(files)

	var all []Entry
	seen := make(map[string]string)
	for _, f := range files {
		data, err := os.ReadFile(f)
		if err != nil {
			return nil, fmt.Errorf("reading %s: %w", f, err)
		}
		var entries []Entry
		if err := yaml.Unmarshal(data, &entries); err != nil {
			return nil, fmt.Errorf("parsing %s: %w", f, err)
		}
		for i := range entries {
			e := &entries[i]
			e.SourceFile = f
			if e.ID == "" {
				return nil, fmt.Errorf("%s: entry %d: missing id", f, i)
			}
			if e.Tool == "" {
				return nil, fmt.Errorf("%s: %s: missing tool", f, e.ID)
			}
			if e.Expect == "" {
				return nil, fmt.Errorf("%s: %s: missing expect", f, e.ID)
			}
			if _, err := e.ExpectedAction(); err != nil {
				return nil, fmt.Errorf("%s: %s: %w", f, e.ID, err)
			}
			if _, err := e.CanonicalTool(); err != nil {
				return nil, fmt.Errorf("%s: %s: %w", f, e.ID, err)
			}
			if prev, ok := seen[e.ID]; ok {
				return nil, fmt.Errorf("duplicate entry id %q in %s (also in %s)", e.ID, f, prev)
			}
			seen[e.ID] = f
		}
		all = append(all, entries...)
	}
	return all, nil
}
