package policy

import (
	"testing"

	"github.com/kkd16/parry/internal/shellparse"
	"github.com/stretchr/testify/require"
)

func TestStrictest(t *testing.T) {
	tests := []struct {
		name string
		a, b Action
		want Action
	}{
		{"block beats allow", Block, Allow, Block},
		{"allow vs block symmetric", Allow, Block, Block},
		{"block beats confirm", Block, Confirm, Block},
		{"confirm vs block symmetric", Confirm, Block, Block},
		{"block beats empty", Block, "", Block},
		{"empty vs block symmetric", "", Block, Block},
		{"confirm beats allow", Confirm, Allow, Confirm},
		{"allow vs confirm symmetric", Allow, Confirm, Confirm},
		{"confirm beats empty", Confirm, "", Confirm},
		{"empty vs confirm symmetric", "", Confirm, Confirm},
		{"allow beats empty", Allow, "", Allow},
		{"empty vs allow symmetric", "", Allow, Allow},
		{"block vs block", Block, Block, Block},
		{"confirm vs confirm", Confirm, Confirm, Confirm},
		{"allow vs allow", Allow, Allow, Allow},
		{"empty vs empty", "", "", ""},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.want, strictest(tc.a, tc.b))
		})
	}
}

func TestLookupBinaryAction(t *testing.T) {
	tests := []struct {
		name     string
		cmd      shellparse.Command
		binaries map[string]Action
		fallback Action
		want     Action
	}{
		{
			name:     "nil binaries returns fallback",
			cmd:      shellparse.Command{Binary: "rm"},
			binaries: nil,
			fallback: Confirm,
			want:     Confirm,
		},
		{
			name:     "bare binary hit",
			cmd:      shellparse.Command{Binary: "rm"},
			binaries: map[string]Action{"rm": Confirm},
			fallback: Allow,
			want:     Confirm,
		},
		{
			name:     "subcommand hit",
			cmd:      shellparse.Command{Binary: "git", Subcommand: "commit"},
			binaries: map[string]Action{"git commit": Allow},
			fallback: Confirm,
			want:     Allow,
		},
		{
			name:     "subcommand precedence over bare",
			cmd:      shellparse.Command{Binary: "git", Subcommand: "push"},
			binaries: map[string]Action{"git": Allow, "git push": Confirm},
			fallback: Block,
			want:     Confirm,
		},
		{
			name:     "no match returns fallback",
			cmd:      shellparse.Command{Binary: "xyz"},
			binaries: map[string]Action{"rm": Block},
			fallback: Confirm,
			want:     Confirm,
		},
		{
			name:     "subcommand miss falls through to bare",
			cmd:      shellparse.Command{Binary: "git", Subcommand: "invented"},
			binaries: map[string]Action{"git": Allow},
			fallback: Block,
			want:     Allow,
		},
		{
			name:     "compact flag subcommand: rm -rf blocks even though rm confirms",
			cmd:      shellparse.Command{Binary: "rm", Subcommand: "-rf"},
			binaries: map[string]Action{"rm": Confirm, "rm -rf": Block},
			fallback: Allow,
			want:     Block,
		},
		{
			name:     "bare cmd with subcommand unset matches bare entry",
			cmd:      shellparse.Command{Binary: "ls"},
			binaries: map[string]Action{"ls": Allow, "ls -la": Block},
			fallback: Confirm,
			want:     Allow,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.want, lookupBinaryAction(tc.cmd, tc.binaries, tc.fallback))
		})
	}
}
