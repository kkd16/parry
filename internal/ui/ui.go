package ui

import (
	"fmt"
	"io"
	"os"

	"golang.org/x/term"
)

const (
	reset  = "\033[0m"
	bold   = "\033[1m"
	dim    = "\033[2m"
	red    = "\033[31m"
	green  = "\033[32m"
	yellow = "\033[33m"
	blue   = "\033[34m"
)

var (
	outW   io.Writer = os.Stdout
	errW   io.Writer = os.Stderr
	outTTY           = term.IsTerminal(int(os.Stdout.Fd()))
	errTTY           = term.IsTerminal(int(os.Stderr.Fd()))
)

func styled(w io.Writer, isTTY bool, color, symbol, msg string) {
	if isTTY {
		_, _ = fmt.Fprintf(w, "\n %s%s%s %s\n", color, symbol, reset, msg)
	} else {
		_, _ = fmt.Fprintf(w, "\n %s %s\n", symbol, msg)
	}
}

func Success(msg string) {
	styled(outW, outTTY, green, "✓", msg)
}

func Error(msg string) {
	styled(errW, errTTY, red, "✗", msg)
}

func Warn(msg string) {
	styled(errW, errTTY, yellow, "⚠", msg)
}

func Info(msg string) {
	styled(outW, outTTY, blue, "→", msg)
}

func Detail(key, value string) {
	if outTTY {
		_, _ = fmt.Fprintf(outW, "   %s%-10s%s %s\n", dim, key, reset, value)
	} else {
		_, _ = fmt.Fprintf(outW, "   %-10s %s\n", key, value)
	}
}

func Break() {
	_, _ = fmt.Fprintln(outW)
}

func colorf(isTTY bool, c, format string, a ...any) string {
	if isTTY {
		return fmt.Sprintf("%s"+format+"%s", append([]any{c}, append(a, reset)...)...)
	}
	return fmt.Sprintf(format, a...)
}

func Boldf(format string, a ...any) string  { return colorf(outTTY, bold, format, a...) }
func Dimf(format string, a ...any) string   { return colorf(outTTY, dim, format, a...) }
func Greenf(format string, a ...any) string { return colorf(outTTY, green, format, a...) }
func Redf(format string, a ...any) string   { return colorf(outTTY, red, format, a...) }
func Yellowf(format string, a ...any) string { return colorf(outTTY, yellow, format, a...) }
func Bluef(format string, a ...any) string  { return colorf(outTTY, blue, format, a...) }

func SectionHeader(label string) {
	if outTTY {
		_, _ = fmt.Fprintf(outW, "   %s──%s %s%s%s\n", dim, reset, bold, label, reset)
	} else {
		_, _ = fmt.Fprintf(outW, "   -- %s\n", label)
	}
}

func Separator() {
	if outTTY {
		_, _ = fmt.Fprintf(outW, "   %s────────────────────%s\n", dim, reset)
	} else {
		_, _ = fmt.Fprintln(outW)
	}
}

func LogCheck(action, command string) {
	if !errTTY {
		return
	}

	var color, symbol string
	switch action {
	case "allow":
		color, symbol = green, "✓"
	case "block":
		color, symbol = red, "⚡"
	case "observe":
		color, symbol = yellow, "⚠"
	default:
		color, symbol = blue, "→"
	}

	cmd := command
	if len(cmd) > 60 {
		cmd = cmd[:57] + "..."
	}

	_, _ = fmt.Fprintf(errW, " %s%s%s %-8s %s%s%s\n",
		color, symbol, reset,
		action,
		dim, cmd, reset,
	)
}
