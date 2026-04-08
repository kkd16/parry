package store_test

import (
	"os"
	"testing"

	"github.com/kkd16/parry/internal/store"
	"github.com/stretchr/testify/require"
)

func TestSession_StableForSameCwd(t *testing.T) {
	t.Chdir(t.TempDir())
	a := store.Session()
	b := store.Session()
	require.Equal(t, a, b)
}

func TestSession_HexEncoded(t *testing.T) {
	s := store.Session()
	require.Len(t, s, 64)
	for _, c := range s {
		require.True(t, (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'), "non-hex char %q", c)
	}
}

func TestSession_DifferentCwds(t *testing.T) {
	t.Chdir(t.TempDir())
	first := store.Session()

	t.Chdir(t.TempDir())
	second := store.Session()

	require.NotEqual(t, first, second)
}

func TestWorkdir_MatchesGetwd(t *testing.T) {
	want, err := os.Getwd()
	require.NoError(t, err)
	require.Equal(t, want, store.Workdir())
}

func TestWorkdir_NonEmpty(t *testing.T) {
	require.NotEmpty(t, store.Workdir())
}
