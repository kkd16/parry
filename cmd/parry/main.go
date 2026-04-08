package main

import (
	"os"

	"github.com/alecthomas/kong"
	"github.com/kkd16/parry/internal/agents"
	"github.com/kkd16/parry/internal/check"
	"github.com/kkd16/parry/internal/paths"
	"github.com/kkd16/parry/internal/policy"
	"github.com/kkd16/parry/internal/ui"
)

func parryDir() (string, error)       { return paths.Dir() }
func loadPolicy() (*policy.Engine, error) { return paths.LoadPolicy() }

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
	agents.Register()

	var cli CLI
	ctx := kong.Parse(&cli,
		kong.Name("parry"),
		kong.Description("Runtime security enforcement for AI agents."),
		kong.UsageOnError(),
	)
	err := ctx.Run()
	ctx.FatalIfErrorf(err)
}
