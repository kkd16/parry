package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/alecthomas/kong"
	"github.com/kkd16/parry/configs"
	_ "github.com/kkd16/parry/internal/agents"
	"github.com/kkd16/parry/internal/check"
	"github.com/kkd16/parry/internal/policy"
	"github.com/kkd16/parry/internal/ui"
)

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

func fatal(err error) {
	ui.Error(err.Error())
	os.Exit(check.ExitBlock)
}

type CLI struct {
	Check     CheckCmd     `cmd:"" help:"Evaluate a tool call from stdin against policy."`
	Init      InitCmd      `cmd:"" help:"Initialize Parry configuration."`
	Config    ConfigCmd    `cmd:"" help:"View and manage Parry configuration."`
	Validate  ValidateCmd  `cmd:"" help:"Validate policy YAML for errors."`
	Dashboard DashboardCmd `cmd:"" help:"Start the web dashboard."`
	Eval      EvalCmd      `cmd:"" help:"Run the adversarial corpus against the embedded default policy."`
	Nuke      NukeCmd      `cmd:"" help:"Remove all Parry config, data, and policy."`
	Version   VersionCmd   `cmd:"" help:"Print version."`
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
