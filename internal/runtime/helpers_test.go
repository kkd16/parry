package runtime

import (
	"path/filepath"
	"strings"
	"testing"

	"github.com/kkd16/parry/internal/notify"
	notifymocks "github.com/kkd16/parry/internal/notify/mocks"
	"github.com/kkd16/parry/internal/policy"
	"github.com/kkd16/parry/internal/store"
	"github.com/stretchr/testify/require"
	"go.uber.org/mock/gomock"
)

func loadEngine(tb testing.TB, yamlDoc string) *policy.Engine {
	tb.Helper()
	e := policy.NewEngine()
	require.NoError(tb, e.LoadBytes([]byte(yamlDoc)))
	return e
}

func shellRuleYAML(mode, key, binary string) string {
	return `version: 1
mode: ` + mode + `
check_mode_confirm: block
default_action: confirm
rules:
  shell:
    default_action: confirm
    ` + key + `: [` + binary + `]
`
}

func tempDB(tb testing.TB) string {
	tb.Helper()
	return filepath.Join(tb.TempDir(), "runtime-test.db")
}

func openStoreAt(tb testing.TB, path string) *store.Store {
	tb.Helper()
	s, err := store.Open(path)
	require.NoError(tb, err)
	tb.Cleanup(func() { _ = s.Close() })
	return s
}

func listAllEvents(tb testing.TB, path string) []store.EventRow {
	tb.Helper()
	s := openStoreAt(tb, path)
	rows, _, err := s.ListEvents(100, 0, 0, "", "", "", "", "")
	require.NoError(tb, err)
	return rows
}

func registerMockProvider(t *testing.T, m *notifymocks.MockProvider) string {
	t.Helper()
	name := "runtime-test-" + strings.ReplaceAll(t.Name(), "/", "-")
	m.EXPECT().Name().Return(name)
	notify.Register(m)
	return name
}

func newMockConfirmer(t *testing.T) (string, *notifymocks.MockConfirmer) {
	t.Helper()
	ctrl := gomock.NewController(t)
	mp := notifymocks.NewMockProvider(ctrl)
	mc := notifymocks.NewMockConfirmer(ctrl)
	name := registerMockProvider(t, mp)
	mp.EXPECT().NewConfirmer(gomock.Any()).Return(mc, nil)
	return name, mc
}

func pinCwd(t *testing.T) {
	t.Helper()
	t.Chdir(t.TempDir())
}
