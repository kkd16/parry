package runtime

import (
	"context"
	"errors"
	"fmt"
	"os"

	"github.com/kkd16/parry/internal/check"
	"github.com/kkd16/parry/internal/notify"
	"github.com/kkd16/parry/internal/policy"
	"github.com/kkd16/parry/internal/ui"
)

func confirmViaNotify(parent context.Context, p *policy.Policy, tc *check.ToolCall) Verdict {
	prov, ok := notify.GetProvider(p.Notifications.Provider)
	if !ok {
		fmt.Fprintf(os.Stderr, "parry: unknown notification provider %q\n", p.Notifications.Provider)
		return resolveVerdict(p, p.CheckModeConfirm)
	}

	confirmer, err := prov.NewConfirmer(p.Notifications.ProviderConfig())
	if err != nil {
		fmt.Fprintf(os.Stderr, "parry: notify: %v\n", err)
		return resolveVerdict(p, p.CheckModeConfirm)
	}

	timeout := p.Notifications.ParseTimeout()
	ctx, cancel := context.WithTimeout(parent, timeout)
	defer cancel()

	cmd, _ := tc.ToolInput["command"].(string)
	if cmd == "" {
		cmd = tc.RawName
	}

	ui.Info(fmt.Sprintf("waiting for confirmation (%s timeout)...", timeout))

	approved, err := confirmer.Confirm(ctx, notify.ConfirmRequest{
		Tool:    string(tc.Tool),
		RawName: tc.RawName,
		Command: cmd,
	})
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) {
			ui.Warn(fmt.Sprintf("confirmation timed out after %s", timeout))
		} else {
			fmt.Fprintf(os.Stderr, "parry: notify: %v\n", err)
		}
		return resolveVerdict(p, p.CheckModeConfirm)
	}
	if approved {
		return Verdict{"allow", "allow", ""}
	}
	return Verdict{"block", "deny", "Denied via notification"}
}
