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
		fmt.Fprintf(w, "\n %s%s%s %s\n", color, symbol, reset, msg)
	} else {
		fmt.Fprintf(w, "\n %s %s\n", symbol, msg)
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
		fmt.Fprintf(outW, "   %s%-10s%s %s\n", dim, key, reset, value)
	} else {
		fmt.Fprintf(outW, "   %-10s %s\n", key, value)
	}
}

func Break() {
	fmt.Fprintln(outW)
}

func Boldf(format string, a ...any) string {
	if outTTY {
		return fmt.Sprintf("%s"+format+"%s", append([]any{bold}, append(a, reset)...)...)
	}
	return fmt.Sprintf(format, a...)
}

func Dimf(format string, a ...any) string {
	if outTTY {
		return fmt.Sprintf("%s"+format+"%s", append([]any{dim}, append(a, reset)...)...)
	}
	return fmt.Sprintf(format, a...)
}

// LogCheck prints a one-liner to stderr showing a check decision.
// Only outputs when stderr is a TTY (silent in pipes/CI).
func LogCheck(action, command string, tier int) {
	if !errTTY {
		return
	}

	tierLabel := fmt.Sprintf("T%d", tier)

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

	fmt.Fprintf(errW, " %s%s%s %-8s %s%s%s  %s\n",
		color, symbol, reset,
		action,
		dim, cmd, reset,
		Dimf("%s", tierLabel),
	)
}
