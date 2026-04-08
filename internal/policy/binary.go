package policy

import "github.com/kkd16/parry/internal/shellparse"

func strictest(a, b Action) Action {
	rank := func(x Action) int {
		switch x {
		case Block:
			return 3
		case Confirm:
			return 2
		case Allow:
			return 1
		default:
			return 0
		}
	}
	if rank(a) >= rank(b) {
		return a
	}
	return b
}

func lookupBinaryAction(cmd shellparse.Command, binaries map[string]Action, fallback Action) Action {
	if binaries == nil {
		return fallback
	}
	if cmd.Subcommand != "" {
		if a, ok := binaries[cmd.Binary+" "+cmd.Subcommand]; ok {
			return a
		}
	}
	if a, ok := binaries[cmd.Binary]; ok {
		return a
	}
	return fallback
}
