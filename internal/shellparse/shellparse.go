package shellparse

import (
	"strings"

	"mvdan.cc/sh/v3/syntax"
)

type Command struct {
	Binary     string
	Subcommand string
	Args       []string
	Resolved   bool
}

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

		binary, binResolved := wordToString(call.Args[0])
		if binary == "" && binResolved {
			return true
		}

		resolved := binResolved

		var sub string
		if len(call.Args) > 1 {
			var subResolved bool
			sub, subResolved = wordToString(call.Args[1])
			if !subResolved {
				resolved = false
			}
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
			s, r := wordToString(arg)
			args = append(args, s)
			if !r {
				resolved = false
			}
		}

		cmds = append(cmds, Command{Binary: binary, Subcommand: sub, Args: args, Resolved: resolved})
		return true
	})

	if len(cmds) == 0 {
		return []Command{{Binary: firstWord(cmd)}}
	}
	return cmds
}

func wordToString(w *syntax.Word) (string, bool) {
	var b strings.Builder
	resolved := true
	for _, part := range w.Parts {
		switch p := part.(type) {
		case *syntax.Lit:
			b.WriteString(p.Value)
		case *syntax.SglQuoted:
			b.WriteString(p.Value)
		default:
			resolved = false
		}
	}
	return b.String(), resolved
}

func HasUnresolved(cmds []Command) bool {
	for _, c := range cmds {
		if !c.Resolved {
			return true
		}
	}
	return false
}

func isBashLike(binary string) bool {
	return binary == "bash" || binary == "sh" || binary == "zsh"
}

func hasCFlag(args []*syntax.Word) bool {
	for _, arg := range args[1:] {
		s, _ := wordToString(arg)
		if s == "-c" {
			return true
		}
	}
	return false
}

func extractCArg(args []*syntax.Word) string {
	for i := 1; i < len(args); i++ {
		s, _ := wordToString(args[i])
		if s == "-c" && i+1 < len(args) {
			r, _ := wordToString(args[i+1])
			return r
		}
	}
	return ""
}

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
