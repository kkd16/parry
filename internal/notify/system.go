package notify

import (
	"context"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"regexp"
	"runtime"
	"strings"

	"github.com/kkd16/parry/internal/ui"
)

func init() {
	Register(&systemProvider{})
}

type systemProvider struct{}

func (p *systemProvider) Name() string { return "system" }

func (p *systemProvider) NewConfirmer(_ map[string]any) (Confirmer, error) {
	backend, err := detectSystemBackend()
	if err != nil {
		return nil, err
	}
	return &SystemConfirmer{backend: backend}, nil
}

func (p *systemProvider) SendTest(ctx context.Context, _ map[string]any) error {
	c, err := p.NewConfirmer(nil)
	if err != nil {
		return err
	}
	approved, err := c.Confirm(ctx, ConfirmRequest{
		Tool:    "test",
		Command: "Parry test notification — click Approve to confirm.",
	})
	if err != nil {
		return err
	}
	if !approved {
		return errors.New("test dialog was denied")
	}
	return nil
}

func (p *systemProvider) RunSetup(policyPath string) error {
	if _, err := detectSystemBackend(); err != nil {
		ui.Error(fmt.Sprintf("system notifier unavailable: %v", err))
		ui.Info("install zenity (Linux) or run on macOS, then re-run setup")
		return err
	}

	if err := setProviderInPolicy(policyPath, "system"); err != nil {
		ui.Error(fmt.Sprintf("configuring notifications: %v", err))
		return err
	}

	if err := p.SendTest(context.Background(), nil); err != nil {
		ui.Warn(fmt.Sprintf("test dialog failed: %v", err))
		ui.Info("notifications configured, but verify your display setup")
	} else {
		ui.Success("test dialog approved")
	}

	ui.Detail("provider", "system")
	ui.Detail("setup", "none required")
	ui.Break()
	return nil
}

type systemBackend struct {
	kind string // "osascript" | "zenity" | "kdialog"
	bin  string
}

func detectSystemBackend() (systemBackend, error) {
	switch runtime.GOOS {
	case "darwin":
		bin, err := exec.LookPath("osascript")
		if err != nil {
			return systemBackend{}, fmt.Errorf("osascript not found")
		}
		return systemBackend{kind: "osascript", bin: bin}, nil
	case "linux":
		if bin, err := exec.LookPath("zenity"); err == nil {
			return systemBackend{kind: "zenity", bin: bin}, nil
		}
		if bin, err := exec.LookPath("kdialog"); err == nil {
			return systemBackend{kind: "kdialog", bin: bin}, nil
		}
		return systemBackend{}, fmt.Errorf("no GUI helper found (install zenity or kdialog)")
	default:
		return systemBackend{}, fmt.Errorf("system notifier not supported on %s", runtime.GOOS)
	}
}

type SystemConfirmer struct {
	backend systemBackend
}

func (s *SystemConfirmer) Confirm(ctx context.Context, req ConfirmRequest) (bool, error) {
	title := fmt.Sprintf("parry: confirm %s?", req.Tool)
	body := req.Command
	if body == "" {
		body = req.RawName
	}

	cmd := s.buildCommand(ctx, title, body)
	err := cmd.Run()
	if err == nil {
		return true, nil
	}
	if ctx.Err() != nil {
		return false, ctx.Err()
	}
	var exitErr *exec.ExitError
	if errors.As(err, &exitErr) {
		return false, nil
	}
	return false, fmt.Errorf("running %s: %w", s.backend.kind, err)
}

func (s *SystemConfirmer) buildCommand(ctx context.Context, title, body string) *exec.Cmd {
	switch s.backend.kind {
	case "osascript":
		script := fmt.Sprintf(
			`display dialog %s with title %s buttons {"Deny", "Approve"} default button "Deny" cancel button "Deny" with icon caution`,
			osaQuote(body), osaQuote(title),
		)
		return exec.CommandContext(ctx, s.backend.bin, "-e", script)
	case "zenity":
		return exec.CommandContext(ctx, s.backend.bin,
			"--question",
			"--title="+title,
			"--text="+body,
			"--ok-label=Approve",
			"--cancel-label=Deny",
			"--default-cancel",
		)
	case "kdialog":
		return exec.CommandContext(ctx, s.backend.bin,
			"--title", title,
			"--warningyesno", body,
		)
	}
	return exec.CommandContext(ctx, "false")
}

// osaQuote escapes a string for inclusion as an AppleScript literal.
func osaQuote(s string) string {
	return `"` + strings.ReplaceAll(strings.ReplaceAll(s, `\`, `\\`), `"`, `\"`) + `"`
}

// setProviderInPolicy rewrites just the `provider:` line in the policy YAML.
// Unlike enableInPolicy, it leaves any provider-specific config (e.g. ntfy
// topic/server) untouched.
func setProviderInPolicy(policyPath, provider string) error {
	raw, err := os.ReadFile(policyPath)
	if err != nil {
		return err
	}
	s := regexp.MustCompile(`(?m)^(  provider:).*`).ReplaceAllString(string(raw), "${1} "+provider)
	return os.WriteFile(policyPath, []byte(s), 0o644)
}
