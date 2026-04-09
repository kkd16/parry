package eval

import (
	"fmt"

	"github.com/kkd16/parry/internal/ui"
)

func Print(s Summary) {
	fmt.Println()
	ui.SectionHeader("Eval results")

	parts := []string{ui.Greenf("%d passed", s.Pass)}
	if s.Bypasses > 0 {
		parts = append(parts, ui.Yellowf("%d known bypasses", s.Bypasses))
	}
	if s.Fail > 0 {
		parts = append(parts, ui.Redf("%d regressions", s.Fail))
	}
	if s.Errored > 0 {
		parts = append(parts, ui.Redf("%d errored", s.Errored))
	}
	fmt.Print("   ")
	for i, p := range parts {
		if i > 0 {
			fmt.Print("   ")
		}
		fmt.Print(p)
	}
	fmt.Print("\n\n")

	if s.Hostile > 0 {
		rate := float64(s.Caught) / float64(s.Hostile) * 100
		ui.SectionHeader("Block rate")
		fmt.Printf("   %s hostile cases, %s caught (block/confirm), %s bypassed (allow)\n",
			ui.Bluef("%d", s.Hostile),
			ui.Greenf("%d", s.Caught),
			ui.Redf("%d", s.TrueBypass),
		)
		fmt.Printf("   %s\n\n", ui.Bluef("%.1f%% block rate", rate))
	}

	if s.Fail == 0 && s.Errored == 0 {
		if s.Bypasses > 0 {
			fmt.Printf("   %s\n\n",
				ui.Yellowf("All failures are known bypasses. No regressions detected."),
			)
		}
		return
	}

	ui.SectionHeader("Regressions")
	for _, r := range s.Results {
		if r.Pass || r.Entry.Bypass {
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
	fmt.Println()
}

func inputPreview(e Entry) string {
	if cmd, ok := e.ToolInput["command"].(string); ok && cmd != "" {
		return ui.Truncate(cmd, 50)
	}
	if path, ok := e.ToolInput["path"].(string); ok && path != "" {
		return ui.Truncate(path, 50)
	}
	return ""
}

