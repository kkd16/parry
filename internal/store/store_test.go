package store_test

import (
	"path/filepath"
	"testing"

	"github.com/kkd16/parry/internal/store"
	"github.com/stretchr/testify/require"
)

func TestOpen_NewDatabase(t *testing.T) {
	path := filepath.Join(t.TempDir(), "fresh.db")
	s, err := store.Open(path)
	require.NoError(t, err)
	require.NoError(t, s.Close())

	s2, err := store.Open(path)
	require.NoError(t, err)
	require.NoError(t, s2.Close())
}

func TestOpen_InvalidPath(t *testing.T) {
	_, err := store.Open(filepath.Join(t.TempDir(), "missing-subdir", "x.db"))
	require.Error(t, err)
}

func TestClose_FirstCallSucceeds(t *testing.T) {
	s, err := store.Open(filepath.Join(t.TempDir(), "close.db"))
	require.NoError(t, err)
	require.NoError(t, s.Close())
}
