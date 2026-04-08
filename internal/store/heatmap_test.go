package store_test

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestFileHeatmap_BasicGrouping(t *testing.T) {
	s := openTempStore(t)
	seedN(t, s, 3, withWorkdir("/proj/a"), withFile("main.go"))
	seedEvent(t, s, makeEvent(withWorkdir("/proj/a"), withFile("util.go")))
	seedN(t, s, 2, withWorkdir("/proj/b"), withFile("lib.go"))

	rows, err := s.FileHeatmap(0)
	require.NoError(t, err)
	require.Len(t, rows, 3)

	require.Equal(t, "/proj/a", rows[0].Workdir)
	require.Equal(t, "main.go", rows[0].Path)
	require.Equal(t, 3, rows[0].Count)

	require.Equal(t, "/proj/a", rows[1].Workdir)
	require.Equal(t, "util.go", rows[1].Path)
	require.Equal(t, 1, rows[1].Count)

	require.Equal(t, "/proj/b", rows[2].Workdir)
	require.Equal(t, "lib.go", rows[2].Path)
	require.Equal(t, 2, rows[2].Count)
}

func TestFileHeatmap_PerProjectLimit(t *testing.T) {
	s := openTempStore(t)
	seedN(t, s, 5, withWorkdir("/proj/a"), withFile("hot.go"))
	seedN(t, s, 4, withWorkdir("/proj/a"), withFile("warm.go"))
	seedN(t, s, 3, withWorkdir("/proj/a"), withFile("cool.go"))
	seedN(t, s, 2, withWorkdir("/proj/a"), withFile("cold.go"))
	seedN(t, s, 6, withWorkdir("/proj/b"), withFile("only.go"))

	rows, err := s.FileHeatmap(2)
	require.NoError(t, err)
	require.Len(t, rows, 3)

	require.Equal(t, "/proj/a", rows[0].Workdir)
	require.Equal(t, "hot.go", rows[0].Path)
	require.Equal(t, "/proj/a", rows[1].Workdir)
	require.Equal(t, "warm.go", rows[1].Path)
	require.Equal(t, "/proj/b", rows[2].Workdir)
	require.Equal(t, "only.go", rows[2].Path)
}

func TestFileHeatmap_FiltersEmptyFileAndWorkdir(t *testing.T) {
	s := openTempStore(t)
	seedEvent(t, s, makeEvent(withWorkdir("/proj/a"), withFile("ok.go")))
	seedEvent(t, s, makeEvent(withWorkdir("/proj/a"), withFile("")))
	seedEvent(t, s, makeEvent(withWorkdir(""), withFile("orphan.go")))
	seedEvent(t, s, makeEvent())

	rows, err := s.FileHeatmap(0)
	require.NoError(t, err)
	require.Len(t, rows, 1)
	require.Equal(t, "/proj/a", rows[0].Workdir)
	require.Equal(t, "ok.go", rows[0].Path)
}

func TestFileHeatmap_EmptyDB(t *testing.T) {
	s := openTempStore(t)
	rows, err := s.FileHeatmap(10)
	require.NoError(t, err)
	require.Empty(t, rows)
}
