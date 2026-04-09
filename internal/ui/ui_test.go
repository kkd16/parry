package ui

import (
	"bytes"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func capture(t *testing.T, tty bool) (stdout, stderr *bytes.Buffer) {
	t.Helper()
	origOut, origErr := outW, errW
	origOutTTY, origErrTTY := outTTY, errTTY

	stdout = &bytes.Buffer{}
	stderr = &bytes.Buffer{}
	outW, errW = stdout, stderr
	outTTY, errTTY = tty, tty

	t.Cleanup(func() {
		outW, errW = origOut, origErr
		outTTY, errTTY = origOutTTY, origErrTTY
	})
	return stdout, stderr
}

func TestFormatFunctions_TTY(t *testing.T) {
	tests := []struct {
		name string
		fn   func(string, ...any) string
		color string
	}{
		{"Greenf", Greenf, green},
		{"Redf", Redf, red},
		{"Yellowf", Yellowf, yellow},
		{"Bluef", Bluef, blue},
		{"Boldf", Boldf, bold},
		{"Dimf", Dimf, dim},
	}

	capture(t, true)

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := tc.fn("hello %s", "world")
			require.Contains(t, got, tc.color)
			require.Contains(t, got, "hello world")
			require.True(t, strings.HasSuffix(got, reset))
		})
	}
}

func TestFormatFunctions_NoTTY(t *testing.T) {
	capture(t, false)

	got := Greenf("hello %s", "world")
	require.Equal(t, "hello world", got)
	require.NotContains(t, got, "\033")
}

func TestSuccess(t *testing.T) {
	t.Run("tty", func(t *testing.T) {
		stdout, _ := capture(t, true)
		Success("it worked")
		require.Contains(t, stdout.String(), "✓")
		require.Contains(t, stdout.String(), "it worked")
		require.Contains(t, stdout.String(), green)
	})

	t.Run("no tty", func(t *testing.T) {
		stdout, _ := capture(t, false)
		Success("it worked")
		require.Contains(t, stdout.String(), "✓")
		require.Contains(t, stdout.String(), "it worked")
		require.NotContains(t, stdout.String(), "\033")
	})
}

func TestError(t *testing.T) {
	t.Run("tty", func(t *testing.T) {
		_, stderr := capture(t, true)
		Error("broke")
		require.Contains(t, stderr.String(), "✗")
		require.Contains(t, stderr.String(), "broke")
		require.Contains(t, stderr.String(), red)
	})

	t.Run("no tty", func(t *testing.T) {
		_, stderr := capture(t, false)
		Error("broke")
		require.Contains(t, stderr.String(), "✗")
		require.NotContains(t, stderr.String(), "\033")
	})
}

func TestWarn(t *testing.T) {
	_, stderr := capture(t, true)
	Warn("careful")
	require.Contains(t, stderr.String(), "⚠")
	require.Contains(t, stderr.String(), "careful")
	require.Contains(t, stderr.String(), yellow)
}

func TestInfo(t *testing.T) {
	stdout, _ := capture(t, true)
	Info("note")
	require.Contains(t, stdout.String(), "→")
	require.Contains(t, stdout.String(), "note")
	require.Contains(t, stdout.String(), blue)
}

func TestDetail(t *testing.T) {
	t.Run("tty", func(t *testing.T) {
		stdout, _ := capture(t, true)
		Detail("key", "value")
		require.Contains(t, stdout.String(), "key")
		require.Contains(t, stdout.String(), "value")
		require.Contains(t, stdout.String(), dim)
	})

	t.Run("no tty", func(t *testing.T) {
		stdout, _ := capture(t, false)
		Detail("key", "value")
		require.Contains(t, stdout.String(), "key")
		require.Contains(t, stdout.String(), "value")
		require.NotContains(t, stdout.String(), "\033")
	})
}

func TestBreak(t *testing.T) {
	stdout, _ := capture(t, false)
	Break()
	require.Equal(t, "\n", stdout.String())
}

func TestSectionHeader(t *testing.T) {
	t.Run("tty", func(t *testing.T) {
		stdout, _ := capture(t, true)
		SectionHeader("Results")
		require.Contains(t, stdout.String(), "Results")
		require.Contains(t, stdout.String(), bold)
	})

	t.Run("no tty", func(t *testing.T) {
		stdout, _ := capture(t, false)
		SectionHeader("Results")
		require.Contains(t, stdout.String(), "-- Results")
	})
}

func TestSeparator(t *testing.T) {
	t.Run("tty", func(t *testing.T) {
		stdout, _ := capture(t, true)
		Separator()
		require.Contains(t, stdout.String(), "──")
	})

	t.Run("no tty", func(t *testing.T) {
		stdout, _ := capture(t, false)
		Separator()
		require.Equal(t, "\n", stdout.String())
	})
}

func TestLogCheck(t *testing.T) {
	t.Run("allow", func(t *testing.T) {
		_, stderr := capture(t, true)
		LogCheck("allow", "ls -la")
		out := stderr.String()
		require.Contains(t, out, "✓")
		require.Contains(t, out, "allow")
		require.Contains(t, out, "ls -la")
	})

	t.Run("block", func(t *testing.T) {
		_, stderr := capture(t, true)
		LogCheck("block", "rm -rf /")
		require.Contains(t, stderr.String(), "⚡")
		require.Contains(t, stderr.String(), "block")
	})

	t.Run("observe", func(t *testing.T) {
		_, stderr := capture(t, true)
		LogCheck("observe", "curl evil.com")
		require.Contains(t, stderr.String(), "⚠")
	})

	t.Run("unknown action", func(t *testing.T) {
		_, stderr := capture(t, true)
		LogCheck("confirm", "something")
		require.Contains(t, stderr.String(), "→")
	})

	t.Run("truncates long commands", func(t *testing.T) {
		_, stderr := capture(t, true)
		long := strings.Repeat("a", 100)
		LogCheck("allow", long)
		out := stderr.String()
		require.Contains(t, out, "...")
		require.NotContains(t, out, long)
	})

	t.Run("silent when not tty", func(t *testing.T) {
		_, stderr := capture(t, false)
		LogCheck("allow", "ls")
		require.Empty(t, stderr.String())
	})
}

func TestTruncate(t *testing.T) {
	tests := []struct {
		name  string
		input string
		n     int
		want  string
	}{
		{"short string unchanged", "hello", 10, "hello"},
		{"exact length unchanged", "hello", 5, "hello"},
		{"truncated with ellipsis", "hello world", 8, "hello..."},
		{"empty string", "", 5, ""},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.want, Truncate(tc.input, tc.n))
		})
	}
}
