package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/alecthomas/kong"
	"github.com/kkd16/parry/configs"
	"github.com/kkd16/parry/internal/check"
	"github.com/kkd16/parry/internal/policy"
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

// fatal logs an error to stderr and exits with the block code.
// Used in check mode to ensure fail-closed behavior on any error.
func fatal(err error) {
	fmt.Fprintf(os.Stderr, "parry: %v\n", err)
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

	action, _, err := engine.Evaluate(tc.ToolName, tc.ToolInput)
	if err != nil {
		fatal(err)
	}

	p := engine.Policy()
	if p.Mode == "observe" {
		check.Respond("allow", "", "")
		return nil
	}

	switch action {
	case policy.Allow:
		check.Respond("allow", "", "")
	case policy.Confirm:
		if p.CheckModeConfirm == policy.Block {
			check.Respond("block", "Blocked by Parry: requires confirmation", "")
		} else {
			check.Respond("allow", "", "")
		}
	case policy.Block:
		check.Respond("block", "Blocked by Parry", "")
	default:
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
		fmt.Println("Policy already exists at", policyPath)
		return nil
	}

	if err := os.WriteFile(policyPath, configs.DefaultPolicy, 0o644); err != nil {
		return fmt.Errorf("writing default policy: %w", err)
	}

	fmt.Println("Initialized Parry config at", dir)
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
		fmt.Println("Nothing to reset — no config found at", dir)
		return nil
	}

	if !n.Force {
		fmt.Printf("This will permanently delete %s and all its contents. Continue? [y/N] ", dir)
		var answer string
		fmt.Scanln(&answer)
		if answer != "y" && answer != "Y" {
			fmt.Println("Aborted.")
			return nil
		}
	}

	if err := os.RemoveAll(dir); err != nil {
		return fmt.Errorf("removing config dir: %w", err)
	}

	fmt.Println("Removed", dir)
	return nil
}

type ReportCmd struct{}

func (r *ReportCmd) Run() error {
	fmt.Println("report: not yet implemented")
	return nil
}

type ValidateCmd struct{}

func (v *ValidateCmd) Run() error {
	fmt.Println("validate: not yet implemented")
	return nil
}

type VersionCmd struct{}

func (v *VersionCmd) Run() error {
	fmt.Println("parry", version)
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
