package policy_test

import (
	"path/filepath"
	"strings"
	"testing"

	"github.com/google/go-cmp/cmp"
	"github.com/kkd16/parry/internal/policy"
	"github.com/stretchr/testify/require"
)

const editBaseYAML = `version: 1
mode: observe
check_mode_confirm: block

notifications:
  provider: ""
  confirmation_timeout: 5m
  ntfy:
    topic: ""
    server: https://ntfy.sh

default_action: confirm
rules:
  shell:
    default_action: confirm
`

func TestSetMode(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		newMode  string
		wantLine string
	}{
		{
			name:     "observe to enforce",
			input:    editBaseYAML,
			newMode:  "enforce",
			wantLine: "mode: enforce",
		},
		{
			name:     "enforce to observe",
			input:    strings.Replace(editBaseYAML, "mode: observe", "mode: enforce", 1),
			newMode:  "observe",
			wantLine: "mode: observe",
		},
		{
			name:     "trailing comment is consumed",
			input:    strings.Replace(editBaseYAML, "mode: observe", "mode: observe  # was enforce", 1),
			newMode:  "enforce",
			wantLine: "mode: enforce",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			path := writeTempPolicy(t, tc.input)
			require.NoError(t, policy.SetMode(path, tc.newMode))

			out := readFile(t, path)

			e := loadEngine(t, out)
			require.Equal(t, tc.newMode, e.Policy().Mode)

			expected := strings.Split(tc.input, "\n")
			for i, line := range expected {
				if strings.HasPrefix(strings.TrimLeft(line, " \t"), "mode:") {
					expected[i] = tc.wantLine
					break
				}
			}
			if diff := cmp.Diff(expected, strings.Split(out, "\n")); diff != "" {
				t.Fatalf("file mismatch (-want +got):\n%s", diff)
			}
		})
	}
}

func TestSetMode_Idempotent(t *testing.T) {
	path := writeTempPolicy(t, editBaseYAML)
	require.NoError(t, policy.SetMode(path, "enforce"))
	first := readFile(t, path)

	require.NoError(t, policy.SetMode(path, "enforce"))
	second := readFile(t, path)

	require.Equal(t, first, second)
}

func TestSetMode_NoModeField(t *testing.T) {
	yamlNoMode := `version: 1
check_mode_confirm: block
default_action: confirm
rules:
  shell:
    default_action: confirm
`
	path := writeTempPolicy(t, yamlNoMode)
	err := policy.SetMode(path, "enforce")
	require.Error(t, err)
	require.Contains(t, err.Error(), "could not find mode field")

	require.Equal(t, yamlNoMode, readFile(t, path))
}

func TestSetMode_FileNotFound(t *testing.T) {
	err := policy.SetMode(filepath.Join(t.TempDir(), "nope.yaml"), "enforce")
	require.Error(t, err)
	require.Contains(t, err.Error(), "reading policy")
}

func TestSetNotificationProvider(t *testing.T) {
	t.Run("change provider only", func(t *testing.T) {
		path := writeTempPolicy(t, editBaseYAML)
		require.NoError(t, policy.SetNotificationProvider(path, "system", nil))

		out := readFile(t, path)
		require.Contains(t, out, "  provider: system")

		e := loadEngine(t, out)
		require.Equal(t, "system", e.Policy().Notifications.Provider)
	})

	t.Run("set ntfy with topic and server", func(t *testing.T) {
		path := writeTempPolicy(t, editBaseYAML)
		require.NoError(t, policy.SetNotificationProvider(path, "ntfy", map[string]string{
			"topic":  "abc",
			"server": "https://example.com",
		}))

		out := readFile(t, path)
		require.Contains(t, out, "  provider: ntfy")
		require.Contains(t, out, "    topic: abc")
		require.Contains(t, out, "    server: https://example.com")

		e := loadEngine(t, out)
		require.Equal(t, "ntfy", e.Policy().Notifications.Provider)
	})

	t.Run("change provider leaves existing cfg untouched", func(t *testing.T) {
		input := strings.Replace(editBaseYAML, `provider: ""`, "provider: ntfy", 1)
		input = strings.Replace(input, `topic: ""`, "topic: existing", 1)

		path := writeTempPolicy(t, input)
		require.NoError(t, policy.SetNotificationProvider(path, "system", nil))

		out := readFile(t, path)
		require.Contains(t, out, "  provider: system")
		require.Contains(t, out, "    topic: existing")
	})
}

func TestSetNotificationProvider_Idempotent(t *testing.T) {
	path := writeTempPolicy(t, editBaseYAML)
	require.NoError(t, policy.SetNotificationProvider(path, "ntfy", map[string]string{
		"topic":  "abc",
		"server": "https://example.com",
	}))
	first := readFile(t, path)

	require.NoError(t, policy.SetNotificationProvider(path, "ntfy", map[string]string{
		"topic":  "abc",
		"server": "https://example.com",
	}))
	second := readFile(t, path)

	require.Equal(t, first, second)
}

func TestSetNotificationProvider_FileNotFound(t *testing.T) {
	err := policy.SetNotificationProvider(filepath.Join(t.TempDir(), "nope.yaml"), "system", nil)
	require.Error(t, err)
	require.Contains(t, err.Error(), "reading policy")
}

func TestSetNotificationProvider_RegexAnchorBoundary(t *testing.T) {
	input := editBaseYAML +
		"\n# decoy comment about provider: foo\n" +
		"some_other_block:\n    provider: untouched\n"

	path := writeTempPolicy(t, input)
	require.NoError(t, policy.SetNotificationProvider(path, "system", nil))

	out := readFile(t, path)
	require.Contains(t, out, "# decoy comment about provider: foo")
	require.Contains(t, out, "    provider: untouched")
	require.Contains(t, out, "  provider: system")
}
