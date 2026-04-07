package eval

import (
	"fmt"
	"unicode/utf8"

	"github.com/kkd16/parry/internal/ui"
)

func Print(s Summary) {
	fmt.Println()
	ui.SectionHeader("Eval results")

	if s.Pass == s.Total {
		fmt.Printf("   %s\n\n", ui.Greenf("%d/%d passed", s.Pass, s.Total))
		return
	}

	fmt.Printf("   %s   %s   %s\n\n",
		ui.Greenf("%d passed", s.Pass),
		ui.Redf("%d failed", s.Fail),
		ui.Yellowf("%d errored", s.Errored),
	)

	ui.SectionHeader("Failures")
	for _, r := range s.Results {
		if r.Pass {
			continue
		}
		idCol := ui.Redf("%-12s", r.Entry.ID)
		catCol := ui.Dimf("%-14s", r.Entry.Category)
		if r.Err != nil {
			fmt.Printf("   %s  %s  %s\n", idCol, catCol, ui.Yellowf("error: %v", r.Err))
			continue
		}
		fmt.Printf("   %s  %s  expected=%s got=%s  %s\n",
			idCol, catCol,
			ui.Greenf("%s", string(r.Entry.expected)),
			ui.Redf("%s", string(r.Got)),
			ui.Dimf("%s", inputPreview(r.Entry)),
		)
	}

	fmt.Printf("\n   %s\n\n",
		ui.Dimf("These are bypasses. Fix in internal/policy and internal/shellparse, then re-run."),
	)
}

func inputPreview(e Entry) string {
	if cmd, ok := e.ToolInput["command"].(string); ok && cmd != "" {
		return truncate(cmd, 50)
	}
	if path, ok := e.ToolInput["path"].(string); ok && path != "" {
		return truncate(path, 50)
	}
	return ""
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	cut := n - 3
	for cut > 0 && !utf8.RuneStart(s[cut]) {
		cut--
	}
	return s[:cut] + "..."
}
