package shellparse

import (
	"strings"

	"mvdan.cc/sh/v3/syntax"
)

type Command struct {
	Binary     string
	Subcommand string
	Args       []string
}

// Parse extracts all commands from a shell command string, handling pipes,
// chains (&&, ||), subshells, and bash -c "..." wrappers.
func Parse(cmd string) []Command {
	parser := syntax.NewParser(syntax.KeepComments(false))
	f, err := parser.Parse(strings.NewReader(cmd), "")
	if err != nil {
		return []Command{{Binary: firstWord(cmd)}}
	}

	var cmds []Command
	syntax.Walk(f, func(node syntax.Node) bool {
		call, ok := node.(*syntax.CallExpr)
		if !ok || len(call.Args) == 0 {
			return true
		}

		binary := wordToString(call.Args[0])
		if binary == "" {
			return true
		}

		var sub string
		if len(call.Args) > 1 {
			sub = wordToString(call.Args[1])
		}

		if isBashLike(binary) && hasCFlag(call.Args) {
			inner := extractCArg(call.Args)
			if inner != "" {
				cmds = append(cmds, Parse(inner)...)
				return true
			}
		}

		var args []string
		for _, arg := range call.Args[1:] {
			args = append(args, wordToString(arg))
		}

		cmds = append(cmds, Command{Binary: binary, Subcommand: sub, Args: args})
		return true
	})

	if len(cmds) == 0 {
		return []Command{{Binary: firstWord(cmd)}}
	}
	return cmds
}

func wordToString(w *syntax.Word) string {
	var b strings.Builder
	for _, part := range w.Parts {
		if lit, ok := part.(*syntax.Lit); ok {
			b.WriteString(lit.Value)
		}
	}
	return b.String()
}

func isBashLike(binary string) bool {
	return binary == "bash" || binary == "sh" || binary == "zsh"
}

func hasCFlag(args []*syntax.Word) bool {
	for _, arg := range args[1:] {
		if wordToString(arg) == "-c" {
			return true
		}
	}
	return false
}

func extractCArg(args []*syntax.Word) string {
	for i := 1; i < len(args); i++ {
		if wordToString(args[i]) == "-c" && i+1 < len(args) {
			return wordToString(args[i+1])
		}
	}
	return ""
}

// ExtractArgs pulls all non-flag arguments from parsed commands.
func ExtractArgs(cmds []Command) []string {
	seen := make(map[string]bool)
	var args []string
	for _, c := range cmds {
		for _, arg := range c.Args {
			if arg == "" || strings.HasPrefix(arg, "-") {
				continue
			}
			if !seen[arg] {
				seen[arg] = true
				args = append(args, arg)
			}
		}
	}
	return args
}

func firstWord(cmd string) string {
	fields := strings.Fields(cmd)
	if len(fields) == 0 {
		return ""
	}
	return fields[0]
}
