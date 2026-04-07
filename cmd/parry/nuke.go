package main

import (
	"fmt"
	"os"

	"github.com/kkd16/parry/internal/ui"
)

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
