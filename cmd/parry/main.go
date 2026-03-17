package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/alecthomas/kong"
	"github.com/kkd16/parry/configs"
	"github.com/kkd16/parry/internal/check"
	"github.com/kkd16/parry/internal/policy"
	"github.com/kkd16/parry/internal/ui"
)

var version = "dev"

func parryDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("finding home directory: %w", err)
	}
	return filepath.Join(home, ".parry"), nil
}

func loadPolicy() (*policy.Engine, error) {
	engine := policy.NewEngine()
	dir, err := parryDir()
	if err != nil {
		return nil, err
	}
	path := filepath.Join(dir, "policy.yaml")
	if _, err := os.Stat(path); err == nil {
		return engine, engine.Load(path)
	}
	return engine, engine.LoadBytes(configs.DefaultPolicy)
}

type CLI struct {
	Check    CheckCmd    `cmd:"" help:"Evaluate a tool call from stdin against policy."`
	Init     InitCmd     `cmd:"" help:"Initialize Parry configuration."`
	Report   ReportCmd   `cmd:"" help:"Show observe mode report."`
	Validate ValidateCmd `cmd:"" help:"Validate policy YAML for errors."`
	Nuke     NukeCmd     `cmd:"" help:"Remove all Parry config, data, and policy."`
	Version  VersionCmd  `cmd:"" help:"Print version."`
}

func fatal(err error) {
	ui.Error(err.Error())
	os.Exit(check.ExitBlock)
}

type CheckCmd struct{}

func (c *CheckCmd) Run() error {
	tc, err := check.ParseInput(os.Stdin)
	if err != nil {
		fatal(err)
	}

	engine, err := loadPolicy()
	if err != nil {
		fatal(err)
	}

	action, tier, err := engine.Evaluate(tc.ToolName, tc.ToolInput)
	if err != nil {
		fatal(err)
	}

	cmd, _ := tc.ToolInput["command"].(string)
	p := engine.Policy()

	if p.Mode == "observe" {
		ui.LogCheck("observe", cmd, int(tier))
		check.Respond("allow", "", "")
		return nil
	}

	switch action {
	case policy.Allow:
		ui.LogCheck("allow", cmd, int(tier))
		check.Respond("allow", "", "")
	case policy.Confirm:
		if p.CheckModeConfirm == policy.Block {
			ui.LogCheck("block", cmd, int(tier))
			check.Respond("block", "Blocked by Parry: requires confirmation", "")
		} else {
			ui.LogCheck("allow", cmd, int(tier))
			check.Respond("allow", "", "")
		}
	case policy.Block:
		ui.LogCheck("block", cmd, int(tier))
		check.Respond("block", "Blocked by Parry", "")
	default:
		ui.LogCheck("block", cmd, int(tier))
		check.Respond("block", "Blocked by Parry: unknown action", "")
	}
	return nil
}

type InitCmd struct{}

func (i *InitCmd) Run() error {
	dir, err := parryDir()
	if err != nil {
		return err
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return fmt.Errorf("creating config dir: %w", err)
	}

	policyPath := filepath.Join(dir, "policy.yaml")
	if _, err := os.Stat(policyPath); err == nil {
		ui.Info("already set up")
		ui.Detail("policy", policyPath)
		ui.Break()
		return nil
	}

	if err := os.WriteFile(policyPath, configs.DefaultPolicy, 0o644); err != nil {
		return fmt.Errorf("writing default policy: %w", err)
	}

	ui.Success("parry is set up")
	ui.Detail("config", dir)
	ui.Detail("policy", policyPath)
	ui.Detail("mode", "observe "+ui.Dimf("(edit policy, then parry validate)"))
	ui.Break()
	return nil
}

type NukeCmd struct {
	Force bool `name:"force" short:"f" help:"Skip confirmation prompt."`
}

func (n *NukeCmd) Run() error {
	dir, err := parryDir()
	if err != nil {
		return err
	}

	if _, err := os.Stat(dir); os.IsNotExist(err) {
		ui.Info("nothing to nuke — no config found")
		ui.Break()
		return nil
	}

	if !n.Force {
		ui.Warn("this will permanently delete " + dir)
		fmt.Print("   continue? [y/N] ")
		var answer string
		_, _ = fmt.Scanln(&answer)
		if answer != "y" && answer != "Y" {
			ui.Info("aborted")
			ui.Break()
			return nil
		}
	}

	if err := os.RemoveAll(dir); err != nil {
		return fmt.Errorf("removing config dir: %w", err)
	}

	ui.Success("nuked — clean slate")
	ui.Detail("removed", dir)
	ui.Break()
	return nil
}

type ReportCmd struct{}

func (r *ReportCmd) Run() error {
	ui.Info("report is not built yet — coming soon")
	return nil
}

type ValidateCmd struct{}

func (v *ValidateCmd) Run() error {
	dir, err := parryDir()
	if err != nil {
		return err
	}
	path := filepath.Join(dir, "policy.yaml")
	if _, err := os.Stat(path); os.IsNotExist(err) {
		ui.Error("no policy found — run " + ui.Boldf("parry init") + " first")
		ui.Break()
		return fmt.Errorf("no policy file at %s", path)
	}
	engine := policy.NewEngine()
	if err := engine.Load(path); err != nil {
		ui.Error("policy is broken")
		ui.Detail("error", err.Error())
		ui.Break()
		return err
	}

	p := engine.Policy()
	ui.Success("policy looks good")
	ui.Detail("file", path)
	ui.Detail("mode", p.Mode)
	ui.Detail("rules", fmt.Sprintf("%d", len(p.Rules)))

	binaries := 0
	for _, r := range p.Rules {
		binaries += len(r.Binaries)
	}
	ui.Detail("binaries", fmt.Sprintf("%d classified", binaries))
	ui.Detail("paths", fmt.Sprintf("%d protected", len(p.ProtectedPaths)))
	ui.Break()
	return nil
}

type VersionCmd struct{}

func (v *VersionCmd) Run() error {
	fmt.Printf(" parry %s\n", ui.Boldf("%s", version))
	return nil
}

func main() {
	var cli CLI
	ctx := kong.Parse(&cli,
		kong.Name("parry"),
		kong.Description("Runtime security enforcement for AI agents."),
		kong.UsageOnError(),
	)
	err := ctx.Run()
	ctx.FatalIfErrorf(err)
}
