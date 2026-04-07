package eval

import (
	"fmt"
	"io"

	"github.com/kkd16/parry/internal/ui"
)

func Print(s Summary, w io.Writer) {
	fmt.Fprintln(w)
	ui.SectionHeader("Eval results")

	headline := fmt.Sprintf("%d/%d passed", s.Pass, s.Total)
	if s.Pass == s.Total {
		fmt.Fprintf(w, "   %s\n", ui.Greenf("%s", headline))
	} else {
		fmt.Fprintf(w, "   %s   %s   %s\n",
			ui.Greenf("%d passed", s.Pass),
			ui.Redf("%d failed", s.Fail),
			ui.Yellowf("%d errored", s.Errored),
		)
	}

	if s.Pass == s.Total {
		fmt.Fprintln(w)
		return
	}

	fmt.Fprintln(w)
	ui.SectionHeader("Failures")
	for _, r := range s.Results {
		if r.Pass {
			continue
		}
		cmd := commandPreview(r.Entry)
		switch {
		case r.Err != nil:
			fmt.Fprintf(w, "   %s  %s  %s\n",
				ui.Redf("%-12s", r.Entry.ID),
				ui.Dimf("%-14s", r.Entry.Category),
				ui.Yellowf("error: %v", r.Err),
			)
		default:
			fmt.Fprintf(w, "   %s  %s  expected=%s got=%s  %s\n",
				ui.Redf("%-12s", r.Entry.ID),
				ui.Dimf("%-14s", r.Entry.Category),
				ui.Greenf("%s", string(r.Expected)),
				ui.Redf("%s", string(r.Got)),
				ui.Dimf("%s", cmd),
			)
		}
	}

	fmt.Fprintln(w)
	fmt.Fprintf(w, "   %s\n",
		ui.Dimf("These are bypasses. Fix in internal/policy and internal/shellparse, then re-run."),
	)
	fmt.Fprintln(w)
}

func commandPreview(e Entry) string {
	if cmd, ok := e.ToolInput["command"].(string); ok && cmd != "" {
		if len(cmd) > 50 {
			return cmd[:47] + "..."
		}
		return cmd
	}
	if path, ok := e.ToolInput["path"].(string); ok && path != "" {
		return path
	}
	return ""
}
