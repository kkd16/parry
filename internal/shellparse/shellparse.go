package shellparse

import (
	"path/filepath"
	"strings"

	"mvdan.cc/sh/v3/syntax"
)

type Command struct {
	Binary     string
	Positional []string
	ShortFlags map[string]bool
	LongFlags  map[string]bool
	Resolved   bool
}

func Parse(cmd string) []Command {
	parser := syntax.NewParser(syntax.KeepComments(false))
	f, err := parser.Parse(strings.NewReader(cmd), "")
	if err != nil {
		return []Command{{Binary: canonicalBinary(firstWord(cmd))}}
	}

	var cmds []Command
	syntax.Walk(f, func(node syntax.Node) bool {
		call, ok := node.(*syntax.CallExpr)
		if !ok || len(call.Args) == 0 {
			return true
		}

		rawBinary, binResolved := wordToString(call.Args[0])
		if rawBinary == "" && binResolved {
			return true
		}

		resolved := binResolved

		if isBashLike(rawBinary) && hasCFlag(call.Args) {
			inner := extractCArg(call.Args)
			if inner != "" {
				cmds = append(cmds, Parse(inner)...)
				return true
			}
		}

		args := make([]string, 0, len(call.Args)-1)
		for _, arg := range call.Args[1:] {
			s, r := wordToString(arg)
			args = append(args, s)
			if !r {
				resolved = false
			}
		}

		positional, short, long := ClassifyFlags(args)

		cmds = append(cmds, Command{
			Binary:     canonicalBinary(rawBinary),
			Positional: positional,
			ShortFlags: short,
			LongFlags:  long,
			Resolved:   resolved,
		})
		return true
	})

	if len(cmds) == 0 {
		return []Command{{Binary: canonicalBinary(firstWord(cmd))}}
	}
	return cmds
}

func ClassifyFlagForm(form string) (short, long string) {
	switch {
	case form == "" || form == "-" || form == "--":
		return "", ""
	case strings.HasPrefix(form, "--"):
		return "", strings.TrimPrefix(form, "--")
	case strings.HasPrefix(form, "-"):
		rest := form[1:]
		if len(rest) == 1 {
			return rest, ""
		}
		return "", rest
	case len(form) == 1:
		return form, ""
	default:
		return "", form
	}
}

func ClassifyFlags(args []string) (positional []string, short map[string]bool, long map[string]bool) {
	endOfOptions := false
	for _, arg := range args {
		if endOfOptions {
			positional = append(positional, arg)
			continue
		}
		switch {
		case arg == "--":
			endOfOptions = true
		case arg == "-" || arg == "":
			positional = append(positional, arg)
		case strings.HasPrefix(arg, "--"):
			name := strings.TrimPrefix(arg, "--")
			if eq := strings.IndexByte(name, '='); eq >= 0 {
				name = name[:eq]
			}
			if name == "" {
				positional = append(positional, arg)
				continue
			}
			if long == nil {
				long = make(map[string]bool)
			}
			long[name] = true
		case strings.HasPrefix(arg, "-"):
			for _, r := range arg[1:] {
				if short == nil {
					short = make(map[string]bool)
				}
				short[string(r)] = true
			}
		default:
			positional = append(positional, arg)
		}
	}
	return positional, short, long
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
		for _, arg := range c.Positional {
			if arg == "" {
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

func canonicalBinary(raw string) string {
	if strings.Contains(raw, "/") {
		return filepath.Base(raw)
	}
	return raw
}

func firstWord(cmd string) string {
	fields := strings.Fields(cmd)
	if len(fields) == 0 {
		return ""
	}
	return fields[0]
}
