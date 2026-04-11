package main

import (
	"fmt"
	"os"

	"github.com/kkd16/parry/internal/paths"
	"github.com/kkd16/parry/internal/policy"
	"github.com/kkd16/parry/internal/ui"
)

type ValidateCmd struct{}

func (v *ValidateCmd) Run() error {
	path, err := paths.PolicyFile()
	if err != nil {
		return err
	}
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

	ruleCount := 0
	for _, r := range p.Rules {
		ruleCount += r.MatcherCount()
	}
	ui.Detail("entries", fmt.Sprintf("%d classified", ruleCount))
	ui.Detail("parry paths", fmt.Sprintf("%d protected", len(p.ParryPaths)))
	ui.Detail("user paths", fmt.Sprintf("%d protected", len(p.ProtectedPaths)))
	ui.Break()
	return nil
}
