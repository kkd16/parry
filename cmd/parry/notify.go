package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/kkd16/parry/internal/notify"
	"github.com/kkd16/parry/internal/paths"
	"github.com/kkd16/parry/internal/ui"
	"golang.org/x/term"
)

type ConfigNotifyCmd struct {
	Setup ConfigNotifySetupCmd `cmd:"" default:"withargs" hidden:"" help:"Configure notification provider."`
	Test  ConfigNotifyTestCmd  `cmd:"" help:"Send a test notification."`
}

type ConfigNotifySetupCmd struct {
	Provider string `arg:"" optional:"" help:"Notification provider to configure."`
}

func (n *ConfigNotifySetupCmd) Run() error {
	engine, err := paths.LoadPolicy()
	if err != nil {
		return err
	}
	p := engine.Policy()

	if p.NotificationsEnabled() {
		ui.Info("notifications already configured")
		ui.Detail("provider", p.Notifications.Provider)
		ui.Break()

		if term.IsTerminal(int(os.Stdin.Fd())) {
			fmt.Print("   reconfigure? [y/N] ")
			var answer string
			_, _ = fmt.Scanln(&answer)
			if answer != "y" && answer != "Y" {
				return nil
			}
		} else {
			return nil
		}
	}

	var prov notify.Provider
	if n.Provider != "" {
		var ok bool
		prov, ok = notify.GetProvider(n.Provider)
		if !ok {
			return fmt.Errorf("unknown provider %q (available: %s)",
				n.Provider, strings.Join(notify.ProviderNames(), ", "))
		}
	} else {
		providers := notify.AllProviders()
		if len(providers) == 0 {
			return fmt.Errorf("no notification providers available")
		}
		if len(providers) == 1 {
			prov = providers[0]
		} else if term.IsTerminal(int(os.Stdin.Fd())) {
			fmt.Println()
			for i, p := range providers {
				fmt.Printf("   [%d] %s\n", i+1, p.Name())
			}
			fmt.Println()
			fmt.Print("   select: ")
			choice := readChoice()
			idx := 0
			if _, err := fmt.Sscanf(choice, "%d", &idx); err != nil || idx < 1 || idx > len(providers) {
				return fmt.Errorf("invalid selection")
			}
			prov = providers[idx-1]
		} else {
			prov = providers[0]
		}
	}

	dir, err := paths.Dir()
	if err != nil {
		return err
	}
	policyPath := filepath.Join(dir, "policy.yaml")

	result, err := prov.RunSetup(policyPath)
	if err != nil {
		return err
	}
	renderSetupResult(result)

	ui.Success("notifications configured")
	ui.Break()
	return nil
}

type ConfigNotifyTestCmd struct{}

func (n *ConfigNotifyTestCmd) Run() error {
	engine, err := paths.LoadPolicy()
	if err != nil {
		return err
	}
	p := engine.Policy()

	if !p.NotificationsEnabled() {
		ui.Error("notifications not configured")
		ui.Info("run " + ui.Boldf("%s", "parry config notify") + " first")
		ui.Break()
		return fmt.Errorf("notifications not configured")
	}

	prov, ok := notify.GetProvider(p.Notifications.Provider)
	if !ok {
		return fmt.Errorf("unknown notification provider %q", p.Notifications.Provider)
	}

	if err := prov.SendTest(context.Background(), p.Notifications.ProviderConfig()); err != nil {
		return err
	}

	ui.Success("test notification sent")
	ui.Detail("provider", p.Notifications.Provider)
	ui.Break()
	return nil
}
