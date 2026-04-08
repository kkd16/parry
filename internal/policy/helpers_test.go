package policy_test

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/kkd16/parry/configs"
	"github.com/kkd16/parry/internal/policy"
	"github.com/stretchr/testify/require"
)

func loadEngine(tb testing.TB, yamlDoc string) *policy.Engine {
	tb.Helper()
	e := policy.NewEngine()
	require.NoError(tb, e.LoadBytes([]byte(yamlDoc)))
	return e
}

func defaultEngine(tb testing.TB) *policy.Engine {
	tb.Helper()
	e := policy.NewEngine()
	require.NoError(tb, e.LoadBytes(configs.DefaultPolicy))
	return e
}

func writeTempPolicy(tb testing.TB, content string) string {
	tb.Helper()
	dir := tb.TempDir()
	path := filepath.Join(dir, "policy.yaml")
	require.NoError(tb, os.WriteFile(path, []byte(content), 0o644))
	return path
}

func readFile(tb testing.TB, path string) string {
	tb.Helper()
	data, err := os.ReadFile(path)
	require.NoError(tb, err)
	return string(data)
}
