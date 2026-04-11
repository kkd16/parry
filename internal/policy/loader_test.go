package policy_test

import (
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/kkd16/parry/internal/policy"
	"github.com/stretchr/testify/require"
)

func TestLoadBytes_DefaultPolicy(t *testing.T) {
	p := defaultEngine(t).Policy()
	require.NotNil(t, p)

	shell := p.Rules["shell"]
	require.NotNil(t, shell)
	require.Positive(t, shell.MatcherCount(), "compile did not run")
	require.True(t, hasBinaryEntry(shell.Allow, "ls"))

	for _, pp := range p.ParryPaths {
		require.False(t, strings.HasPrefix(pp, "~/"), "tilde survived expansion: %s", pp)
	}
}

func hasBinaryEntry(entries []policy.RuleEntry, binary string) bool {
	for _, e := range entries {
		if e.Binary == binary {
			return true
		}
	}
	return false
}

func TestLoadBytes_CompilesMatchers(t *testing.T) {
	yamlDoc := `version: 1
mode: enforce
check_mode_confirm: block
default_action: confirm
rules:
  shell:
    default_action: confirm
    allow:
      - binary: ls
      - binary: cat
    confirm:
      - binary: rm
    block:
      - binary: sudo
`
	e := loadEngine(t, yamlDoc)
	shell := e.Policy().Rules["shell"]

	require.Equal(t, 4, shell.MatcherCount())
	require.True(t, hasBinaryEntry(shell.Allow, "ls"))
	require.True(t, hasBinaryEntry(shell.Allow, "cat"))
	require.True(t, hasBinaryEntry(shell.Confirm, "rm"))
	require.True(t, hasBinaryEntry(shell.Block, "sudo"))
}

func TestLoadBytes_InvalidYAML(t *testing.T) {
	e := policy.NewEngine()
	err := e.LoadBytes([]byte("::not yaml::\n  - [bad"))
	require.Error(t, err)
	require.Contains(t, err.Error(), "parsing policy YAML")
}

const validBaseYAML = `version: 1
mode: enforce
check_mode_confirm: block
default_action: confirm
rules:
  shell:
    default_action: confirm
`

func TestValidate(t *testing.T) {
	tests := []struct {
		name    string
		yaml    string
		errSub  string
	}{
		{
			name:   "wrong version",
			yaml:   strings.Replace(validBaseYAML, "version: 1", "version: 2", 1),
			errSub: "unsupported policy version",
		},
		{
			name:   "missing version defaults to 0",
			yaml:   strings.Replace(validBaseYAML, "version: 1\n", "", 1),
			errSub: "unsupported policy version",
		},
		{
			name:   "invalid mode",
			yaml:   strings.Replace(validBaseYAML, "mode: enforce", "mode: yolo", 1),
			errSub: "invalid mode",
		},
		{
			name:   "missing mode",
			yaml:   strings.Replace(validBaseYAML, "mode: enforce\n", "", 1),
			errSub: "invalid mode",
		},
		{
			name:   "invalid check_mode_confirm",
			yaml:   strings.Replace(validBaseYAML, "check_mode_confirm: block", "check_mode_confirm: maybe", 1),
			errSub: "invalid check_mode_confirm",
		},
		{
			name:   "check_mode_confirm cannot be confirm",
			yaml:   strings.Replace(validBaseYAML, "check_mode_confirm: block", "check_mode_confirm: confirm", 1),
			errSub: `cannot be "confirm"`,
		},
		{
			name:   "invalid default_action",
			yaml:   strings.Replace(validBaseYAML, "default_action: confirm", "default_action: panic", 1),
			errSub: "invalid default_action",
		},
		{
			name:   "missing default_action",
			yaml:   strings.Replace(validBaseYAML, "default_action: confirm\n", "", 1),
			errSub: "invalid default_action",
		},
		{
			name: "unknown rule key",
			yaml: validBaseYAML + "  weird_tool:\n    default_action: allow\n",
			errSub: "unknown rule key",
		},
		{
			name: "invalid rule default_action",
			yaml: strings.Replace(validBaseYAML,
				"  shell:\n    default_action: confirm\n",
				"  shell:\n    default_action: nope\n", 1),
			errSub: "invalid default_action",
		},
		{
			name:   "invalid parry_paths pattern",
			yaml:   validBaseYAML + `parry_paths: ["[bad"]` + "\n",
			errSub: "invalid parry_paths pattern",
		},
		{
			name:   "invalid protected_paths pattern",
			yaml:   validBaseYAML + `protected_paths: ["[bad"]` + "\n",
			errSub: "invalid protected_paths pattern",
		},
		{
			name:   "invalid confirmation_timeout",
			yaml:   validBaseYAML + "notifications:\n  provider: system\n  confirmation_timeout: garbage\n",
			errSub: "notifications.confirmation_timeout",
		},
		{
			name:   "zero confirmation_timeout",
			yaml:   validBaseYAML + "notifications:\n  provider: system\n  confirmation_timeout: 0s\n",
			errSub: "must be positive",
		},
		{
			name:   "invalid rate_limit window",
			yaml:   validBaseYAML + "rate_limit:\n  window: garbage\n  max: 5\n",
			errSub: "rate_limit.window",
		},
		{
			name:   "zero rate_limit window",
			yaml:   validBaseYAML + "rate_limit:\n  window: 0s\n  max: 5\n",
			errSub: "must be positive",
		},
		{
			name:   "rate_limit max less than 1",
			yaml:   validBaseYAML + "rate_limit:\n  window: 1m\n  max: 0\n",
			errSub: "rate_limit.max must be >= 1",
		},
		{
			name:   "invalid rate_limit on_exceed",
			yaml:   validBaseYAML + "rate_limit:\n  window: 1m\n  max: 5\n  on_exceed: maybe\n",
			errSub: "rate_limit.on_exceed",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			e := policy.NewEngine()
			err := e.LoadBytes([]byte(tc.yaml))
			require.Error(t, err)
			require.Contains(t, err.Error(), tc.errSub)
		})
	}
}

func TestValidate_Defaults(t *testing.T) {
	t.Run("rate_limit on_exceed defaults to block", func(t *testing.T) {
		e := loadEngine(t, validBaseYAML+"rate_limit:\n  window: 1m\n  max: 5\n")
		require.Equal(t, policy.Block, e.Policy().RateLimit.OnExceed)
	})

	t.Run("no notifications block is fine", func(t *testing.T) {
		e := loadEngine(t, validBaseYAML)
		require.Nil(t, e.Policy().Notifications)
	})
}

func TestExpandHome(t *testing.T) {
	home, err := os.UserHomeDir()
	require.NoError(t, err)

	yamlDoc := validBaseYAML + `parry_paths:
  - "~/.parry/*"
  - "/literal/parry"
protected_paths:
  - "~/.ssh/*"
  - "/etc/shadow"
`
	p := loadEngine(t, yamlDoc).Policy()
	require.Equal(t, filepath.Join(home, ".parry/*"), p.ParryPaths[0])
	require.Equal(t, "/literal/parry", p.ParryPaths[1])
	require.Equal(t, filepath.Join(home, ".ssh/*"), p.ProtectedPaths[0])
	require.Equal(t, "/etc/shadow", p.ProtectedPaths[1])
}

func TestLoad_File(t *testing.T) {
	t.Run("existing valid file", func(t *testing.T) {
		dir := t.TempDir()
		path := filepath.Join(dir, "policy.yaml")
		require.NoError(t, os.WriteFile(path, []byte(validBaseYAML), 0o644))

		e := policy.NewEngine()
		require.NoError(t, e.Load(path))
		require.NotNil(t, e.Policy())
	})

	t.Run("missing file", func(t *testing.T) {
		e := policy.NewEngine()
		err := e.Load(filepath.Join(t.TempDir(), "nope.yaml"))
		require.Error(t, err)
		require.Contains(t, err.Error(), "reading policy file")
	})

	t.Run("file exists but invalid yaml", func(t *testing.T) {
		dir := t.TempDir()
		path := filepath.Join(dir, "policy.yaml")
		require.NoError(t, os.WriteFile(path, []byte("::garbage:::\n  - [bad"), 0o644))

		e := policy.NewEngine()
		err := e.Load(path)
		require.Error(t, err)
		require.Contains(t, err.Error(), "parsing policy YAML")
	})
}

func TestNewEngine_PolicyNilBeforeLoad(t *testing.T) {
	e := policy.NewEngine()
	require.Nil(t, e.Policy())
}
