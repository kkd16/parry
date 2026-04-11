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

func TestPositionalPrefix(t *testing.T) {
	tests := []struct {
		name string
		rule []string
		cmd  []string
		want bool
	}{
		{"empty rule matches anything", nil, []string{"a", "b"}, true},
		{"exact match", []string{"push"}, []string{"push"}, true},
		{"prefix match", []string{"push"}, []string{"push", "origin"}, true},
		{"longer rule fails", []string{"push", "origin"}, []string{"push"}, false},
		{"different tokens", []string{"push"}, []string{"status"}, false},
		{"empty cmd with non-empty rule", []string{"push"}, nil, false},
		{"both empty", nil, nil, true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.want, positionalPrefix(tc.rule, tc.cmd))
		})
	}
}

func TestRequirementMet(t *testing.T) {
	recursive := flagRequirement{
		Name:       "recursive",
		ShortForms: map[string]bool{"r": true, "R": true},
		LongForms:  map[string]bool{"recursive": true},
	}
	force := flagRequirement{
		Name:       "force",
		ShortForms: map[string]bool{"f": true},
		LongForms:  map[string]bool{"force": true},
	}

	tests := []struct {
		name      string
		reqs      []flagRequirement
		shortCmd  map[string]bool
		longCmd   map[string]bool
		wantMatch bool
	}{
		{"no requirements always matches", nil, nil, nil, true},
		{"single short form satisfies", []flagRequirement{recursive}, map[string]bool{"r": true}, nil, true},
		{"alternate short satisfies", []flagRequirement{recursive}, map[string]bool{"R": true}, nil, true},
		{"long form satisfies", []flagRequirement{recursive}, nil, map[string]bool{"recursive": true}, true},
		{"missing flag fails", []flagRequirement{recursive}, map[string]bool{"f": true}, nil, false},
		{"both requirements met", []flagRequirement{recursive, force}, map[string]bool{"r": true, "f": true}, nil, true},
		{"one requirement missing fails", []flagRequirement{recursive, force}, map[string]bool{"r": true}, nil, false},
		{"mixed short+long satisfies", []flagRequirement{recursive, force}, map[string]bool{"r": true}, map[string]bool{"force": true}, true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.wantMatch, requirementsMet(tc.reqs, tc.shortCmd, tc.longCmd))
		})
	}
}

func TestMatchBinary(t *testing.T) {
	rmEquivalents := FlagEquivalents{
		"rm": {
			"recursive": {"r", "R", "--recursive"},
			"force":     {"f", "--force"},
		},
		"git": {},
	}
	buildRule := func(entries ...entryWithAction) *Rule {
		r := &Rule{FlagEquivalents: rmEquivalents}
		for _, e := range entries {
			switch e.action {
			case Allow:
				r.Allow = append(r.Allow, e.entry)
			case Confirm:
				r.Confirm = append(r.Confirm, e.entry)
			case Block:
				r.Block = append(r.Block, e.entry)
			}
		}
		require.NoError(t, r.compile())
		return r
	}

	rmBare := entryWithAction{Confirm, RuleEntry{Binary: "rm"}}
	rmRecursiveForce := entryWithAction{Block, RuleEntry{Binary: "rm", Flags: []string{"recursive", "force"}}}
	rmRecursive := entryWithAction{Confirm, RuleEntry{Binary: "rm", Flags: []string{"recursive"}}}
	rmForce := entryWithAction{Block, RuleEntry{Binary: "rm", Flags: []string{"force"}}}

	tests := []struct {
		name     string
		cmd      shellparse.Command
		rule     *Rule
		fallback Action
		want     Action
	}{
		{
			name:     "nil matchers returns fallback",
			cmd:      shellparse.Command{Binary: "rm"},
			rule:     &Rule{},
			fallback: Confirm,
			want:     Confirm,
		},
		{
			name:     "bare rm matches bare rule",
			cmd:      shellparse.Command{Binary: "rm"},
			rule:     buildRule(rmBare, rmRecursiveForce),
			fallback: Allow,
			want:     Confirm,
		},
		{
			name: "rm -rf matches recursive+force rule (bundled short)",
			cmd: shellparse.Command{
				Binary:     "rm",
				Positional: []string{"/tmp/x"},
				ShortFlags: map[string]bool{"r": true, "f": true},
			},
			rule:     buildRule(rmBare, rmRecursiveForce),
			fallback: Allow,
			want:     Block,
		},
		{
			name: "rm -r -f matches (separated short)",
			cmd: shellparse.Command{
				Binary:     "rm",
				Positional: []string{"/tmp/x"},
				ShortFlags: map[string]bool{"r": true, "f": true},
			},
			rule:     buildRule(rmBare, rmRecursiveForce),
			fallback: Allow,
			want:     Block,
		},
		{
			name: "rm -rvf matches (superset with extra flag)",
			cmd: shellparse.Command{
				Binary:     "rm",
				Positional: []string{"/tmp/x"},
				ShortFlags: map[string]bool{"r": true, "v": true, "f": true},
			},
			rule:     buildRule(rmBare, rmRecursiveForce),
			fallback: Allow,
			want:     Block,
		},
		{
			name: "rm -r only does not match recursive+force",
			cmd: shellparse.Command{
				Binary:     "rm",
				Positional: []string{"/tmp/x"},
				ShortFlags: map[string]bool{"r": true},
			},
			rule:     buildRule(rmBare, rmRecursiveForce),
			fallback: Allow,
			want:     Confirm,
		},
		{
			name: "rm -Rf matches via R alias",
			cmd: shellparse.Command{
				Binary:     "rm",
				Positional: []string{"/tmp/x"},
				ShortFlags: map[string]bool{"R": true, "f": true},
			},
			rule:     buildRule(rmBare, rmRecursiveForce),
			fallback: Allow,
			want:     Block,
		},
		{
			name: "rm --recursive --force matches via long flags",
			cmd: shellparse.Command{
				Binary:     "rm",
				Positional: []string{"/tmp/x"},
				LongFlags:  map[string]bool{"recursive": true, "force": true},
			},
			rule:     buildRule(rmBare, rmRecursiveForce),
			fallback: Allow,
			want:     Block,
		},
		{
			name: "/bin/rm -rf canonicalized binary matches",
			cmd: shellparse.Command{
				Binary:     "rm",
				RawBinary:  "/bin/rm",
				Positional: []string{"/tmp/x"},
				ShortFlags: map[string]bool{"r": true, "f": true},
			},
			rule:     buildRule(rmBare, rmRecursiveForce),
			fallback: Allow,
			want:     Block,
		},
		{
			name: "POSIX end-of-options: rm -- -rf has empty flags",
			cmd: shellparse.Command{
				Binary:     "rm",
				Positional: []string{"-rf"},
			},
			rule:     buildRule(rmBare, rmRecursiveForce),
			fallback: Allow,
			want:     Confirm,
		},
		{
			name: "specificity tiebreak: recursive confirm and force block on rm -rf (both spec 1)",
			cmd: shellparse.Command{
				Binary:     "rm",
				Positional: []string{"/"},
				ShortFlags: map[string]bool{"r": true, "f": true},
			},
			rule:     buildRule(rmRecursive, rmForce),
			fallback: Allow,
			want:     Block,
		},
		{
			name: "more-specific rule wins over less-specific",
			cmd: shellparse.Command{
				Binary:     "rm",
				Positional: []string{"/"},
				ShortFlags: map[string]bool{"r": true, "f": true},
			},
			rule:     buildRule(rmBare, rmRecursiveForce),
			fallback: Allow,
			want:     Block,
		},
		{
			name:     "git status matches positional prefix rule",
			cmd:      shellparse.Command{Binary: "git", Positional: []string{"status"}},
			rule:     buildRule(entryWithAction{Allow, RuleEntry{Binary: "git", Positional: []string{"status"}}}),
			fallback: Confirm,
			want:     Allow,
		},
		{
			name:     "git status --short still matches git status rule",
			cmd:      shellparse.Command{Binary: "git", Positional: []string{"status"}, LongFlags: map[string]bool{"short": true}},
			rule:     buildRule(entryWithAction{Allow, RuleEntry{Binary: "git", Positional: []string{"status"}}}),
			fallback: Confirm,
			want:     Allow,
		},
		{
			name:     "git status does not match git push rule",
			cmd:      shellparse.Command{Binary: "git", Positional: []string{"status"}},
			rule:     buildRule(entryWithAction{Confirm, RuleEntry{Binary: "git", Positional: []string{"push"}}}),
			fallback: Allow,
			want:     Allow,
		},
		{
			name:     "unknown binary returns fallback",
			cmd:      shellparse.Command{Binary: "xyz"},
			rule:     buildRule(rmBare),
			fallback: Confirm,
			want:     Confirm,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.want, matchBinary(tc.cmd, tc.rule.matchers, tc.fallback))
		})
	}
}

type entryWithAction struct {
	action Action
	entry  RuleEntry
}
