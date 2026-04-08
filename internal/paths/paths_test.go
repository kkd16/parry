package paths_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/kkd16/parry/internal/paths"
	"github.com/stretchr/testify/require"
)

func tempHome(t *testing.T) string {
	t.Helper()
	home := t.TempDir()
	t.Setenv("HOME", home)
	return home
}

func TestPathLookups(t *testing.T) {
	home := tempHome(t)

	tests := []struct {
		name string
		fn   func() (string, error)
		want string
	}{
		{"Dir", paths.Dir, filepath.Join(home, ".parry")},
		{"PolicyFile", paths.PolicyFile, filepath.Join(home, ".parry", "policy.yaml")},
		{"DBFile", paths.DBFile, filepath.Join(home, ".parry", "parry.db")},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := tc.fn()
			require.NoError(t, err)
			require.Equal(t, tc.want, got)
		})
	}
}

const markerPolicy = `version: 1
mode: enforce
check_mode_confirm: block
default_action: allow
rules:
  shell:
    default_action: allow
    allow: [marker_binary]
`

func TestLoadPolicy_FileExists(t *testing.T) {
	home := tempHome(t)

	parryDir := filepath.Join(home, ".parry")
	require.NoError(t, os.MkdirAll(parryDir, 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(parryDir, "policy.yaml"), []byte(markerPolicy), 0o644))

	engine, err := paths.LoadPolicy()
	require.NoError(t, err)
	require.NotNil(t, engine.Policy())
	require.Contains(t, engine.Policy().Rules["shell"].Binaries, "marker_binary")
}

func TestLoadPolicy_FileMissing_FallsBackToDefault(t *testing.T) {
	tempHome(t)

	engine, err := paths.LoadPolicy()
	require.NoError(t, err)
	p := engine.Policy()
	require.NotNil(t, p)
	require.Equal(t, "observe", p.Mode)
	require.Contains(t, p.Rules["shell"].Binaries, "ls")
}

func TestLoadPolicy_DirExistsFileMissing(t *testing.T) {
	home := tempHome(t)

	require.NoError(t, os.MkdirAll(filepath.Join(home, ".parry"), 0o755))

	engine, err := paths.LoadPolicy()
	require.NoError(t, err)
	require.Equal(t, "observe", engine.Policy().Mode)
}

func TestLoadPolicy_FileExistsButInvalid(t *testing.T) {
	home := tempHome(t)

	parryDir := filepath.Join(home, ".parry")
	require.NoError(t, os.MkdirAll(parryDir, 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(parryDir, "policy.yaml"), []byte("::garbage:::\n  - [bad"), 0o644))

	_, err := paths.LoadPolicy()
	require.Error(t, err)
	require.Contains(t, err.Error(), "parsing policy YAML")
}

func TestLoadPolicy_PermissionDenied(t *testing.T) {
	if os.Geteuid() == 0 {
		t.Skip("running as root bypasses unix permissions")
	}
	home := tempHome(t)

	parryDir := filepath.Join(home, ".parry")
	require.NoError(t, os.MkdirAll(parryDir, 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(parryDir, "policy.yaml"), []byte("x"), 0o000))

	_, err := paths.LoadPolicy()
	require.Error(t, err)
}
