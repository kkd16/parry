package main

import (
	"fmt"
	"os"
	"path/filepath"

	"github.com/kkd16/parry/internal/policy"
	"github.com/kkd16/parry/internal/ui"
)

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
	ui.Detail("parry paths", fmt.Sprintf("%d protected", len(p.ParryPaths)))
	ui.Detail("user paths", fmt.Sprintf("%d protected", len(p.ProtectedPaths)))
	ui.Break()
	return nil
}
