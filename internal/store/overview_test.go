package store_test

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestOverview_EmptyDB(t *testing.T) {
	s := openTempStore(t)
	o, err := s.Overview()
	require.NoError(t, err)

	require.Equal(t, 0, o.Total)
	require.Equal(t, 0, o.Today)
	require.Len(t, o.Last7d, 7)
	for _, b := range o.Last7d {
		require.Equal(t, 0, b.Count)
	}
	require.Nil(t, o.ByAction)
	require.Nil(t, o.TopBinaries)
	require.Nil(t, o.TopProject)
	require.Nil(t, o.RecentBlocks)
}

func TestOverview_TotalAndToday(t *testing.T) {
	s := openTempStore(t)
	seedN(t, s, 5)
	o, err := s.Overview()
	require.NoError(t, err)
	require.Equal(t, 5, o.Total)
	require.Equal(t, 5, o.Today)
}

func TestOverview_ByActionDistribution(t *testing.T) {
	s := openTempStore(t)
	seedN(t, s, 3, withAction("allow"))
	seedN(t, s, 2, withAction("block"))
	seedEvent(t, s, makeEvent(withAction("confirm")))

	o, err := s.Overview()
	require.NoError(t, err)
	require.Len(t, o.ByAction, 3)
	require.Equal(t, "allow", o.ByAction[0].Action)
	require.Equal(t, 3, o.ByAction[0].Count)
	require.Equal(t, "block", o.ByAction[1].Action)
	require.Equal(t, 2, o.ByAction[1].Count)
	require.Equal(t, "confirm", o.ByAction[2].Action)
	require.Equal(t, 1, o.ByAction[2].Count)
}

func TestOverview_TopBinaries(t *testing.T) {
	s := openTempStore(t)
	seedN(t, s, 3, withBinary("rm"), withAction("block"))
	seedN(t, s, 2, withBinary("rm"), withAction("confirm"))
	seedN(t, s, 3, withBinary("curl"), withAction("allow"))
	seedN(t, s, 2, withBinary("cat"), withAction("allow"))

	o, err := s.Overview()
	require.NoError(t, err)
	require.Len(t, o.TopBinaries, 3)

	require.Equal(t, "rm", o.TopBinaries[0].Binary)
	require.Equal(t, 5, o.TopBinaries[0].Count)
	require.Equal(t, 3, o.TopBinaries[0].Actions["block"])
	require.Equal(t, 2, o.TopBinaries[0].Actions["confirm"])

	require.Equal(t, "curl", o.TopBinaries[1].Binary)
	require.Equal(t, 3, o.TopBinaries[1].Count)

	require.Equal(t, "cat", o.TopBinaries[2].Binary)
	require.Equal(t, 2, o.TopBinaries[2].Count)
}

func TestOverview_TopBinaries_TruncatesToFive(t *testing.T) {
	s := openTempStore(t)
	for _, b := range []string{"a", "b", "c", "d", "e", "f", "g"} {
		seedEvent(t, s, makeEvent(withBinary(b)))
	}
	o, err := s.Overview()
	require.NoError(t, err)
	require.Len(t, o.TopBinaries, 5)
}

func TestOverview_TopBinaries_FiltersEmptyBinary(t *testing.T) {
	s := openTempStore(t)
	seedEvent(t, s, makeEvent(withBinary("rm")))
	seedEvent(t, s, makeEvent())
	seedEvent(t, s, makeEvent())

	o, err := s.Overview()
	require.NoError(t, err)
	require.Len(t, o.TopBinaries, 1)
	require.Equal(t, "rm", o.TopBinaries[0].Binary)
}

func TestOverview_TopProject(t *testing.T) {
	s := openTempStore(t)
	seedN(t, s, 5, withWorkdir("/proj/a"))
	seedN(t, s, 2, withWorkdir("/proj/b"))

	o, err := s.Overview()
	require.NoError(t, err)
	require.NotNil(t, o.TopProject)
	require.Equal(t, "/proj/a", o.TopProject.Workdir)
	require.Equal(t, 5, o.TopProject.Count)
}

func TestOverview_TopProject_NilWhenNoWorkdir(t *testing.T) {
	s := openTempStore(t)
	seedEvent(t, s, makeEvent())
	seedEvent(t, s, makeEvent())

	o, err := s.Overview()
	require.NoError(t, err)
	require.Nil(t, o.TopProject)
}

func TestOverview_RecentBlocks(t *testing.T) {
	s := openTempStore(t)
	seedN(t, s, 7, withAction("block"))
	seedN(t, s, 3, withAction("allow"))

	o, err := s.Overview()
	require.NoError(t, err)
	require.Len(t, o.RecentBlocks, 5)
	for _, r := range o.RecentBlocks {
		require.Equal(t, "block", r.Action)
	}
}

func TestOverview_Last7dBucketing(t *testing.T) {
	s := openTempStore(t)
	seedN(t, s, 5)

	o, err := s.Overview()
	require.NoError(t, err)
	require.Len(t, o.Last7d, 7)

	today := time.Now().UTC().Format("2006-01-02")
	require.Equal(t, today, o.Last7d[6].Date)
	require.Equal(t, 5, o.Last7d[6].Count)

	for i := 0; i < 6; i++ {
		require.Equal(t, 0, o.Last7d[i].Count)
	}
}
