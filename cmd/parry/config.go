package main

import (
	"fmt"
	"os"
	"strings"

	"github.com/kkd16/parry/internal/policy"
	"github.com/kkd16/parry/internal/setup"
	"github.com/kkd16/parry/internal/paths"
	"github.com/kkd16/parry/internal/ui"
	"golang.org/x/term"
)

type ConfigCmd struct {
	Status ConfigStatusCmd `cmd:"" default:"withargs" hidden:"" help:"Show configuration status."`
	Hook   ConfigHookCmd   `cmd:"" help:"Install Parry hooks in your agent."`
	Notify ConfigNotifyCmd `cmd:"" help:"Configure notifications."`
	Mode   ConfigModeCmd   `cmd:"" help:"View or set enforcement mode."`
}

type ConfigStatusCmd struct{}

func (c *ConfigStatusCmd) Run() error {
	engine, err := paths.LoadPolicy()
	if err != nil {
		ui.Warn("policy not found")
		ui.Info("run " + ui.Boldf("parry init") + " to get started")
		ui.Break()
		return nil
	}
	p := engine.Policy()

	ui.Info("parry configuration")
	ui.Break()

	ui.SectionHeader("Hooks")
	for _, cfg := range setup.All() {
		configPath, err := cfg.ConfigPath()
		if err != nil {
			ui.Detail("  "+cfg.Name(), ui.Redf("error: %v", err))
			continue
		}
		data, err := setup.ReadJSONFile(configPath)
		if err != nil {
			ui.Detail("  "+cfg.Name(), ui.Dimf("not installed"))
			continue
		}
		if cfg.IsInstalled(data) {
			ui.Detail("  "+cfg.Name(), ui.Greenf("installed"))
		} else {
			ui.Detail("  "+cfg.Name(), ui.Dimf("not installed"))
		}
	}

	ui.Separator()
	ui.SectionHeader("Notifications")
	if p.NotificationsEnabled() {
		ui.Detail("  provider", ui.Greenf("%s", p.Notifications.Provider))
	} else {
		ui.Detail("  provider", ui.Dimf("none"))
	}

	ui.Separator()
	ui.SectionHeader("Policy")
	ui.Detail("  mode", p.Mode)
	ui.Detail("  rules", fmt.Sprintf("%d", len(p.Rules)))
	ruleCount := 0
	for _, r := range p.Rules {
		ruleCount += r.MatcherCount()
	}
	ui.Detail("  entries", fmt.Sprintf("%d classified", ruleCount))
	ui.Break()
	return nil
}

type ConfigHookCmd struct {
	Agent string `arg:"" optional:"" help:"Agent to configure (claude, cursor)."`
}

func (h *ConfigHookCmd) Run() error {
	if h.Agent == "" {
		agents := setup.All()
		if len(agents) == 0 {
			ui.Info("no agents available")
			ui.Break()
			return nil
		}
		if !term.IsTerminal(int(os.Stdin.Fd())) {
			return fmt.Errorf("agent argument required in non-interactive mode")
		}

		ui.Info("select an agent to configure")
		fmt.Println()
		for i, a := range agents {
			fmt.Printf("   [%d] %s\n", i+1, a.Name())
		}
		fmt.Println("   [a] all")
		fmt.Println()
		fmt.Print("   select: ")
		choice := readChoice()

		var selected []setup.Configurer
		switch choice {
		case "", "q", "Q":
			return nil
		case "a", "A":
			selected = agents
		default:
			idx := 0
			if _, err := fmt.Sscanf(choice, "%d", &idx); err != nil || idx < 1 || idx > len(agents) {
				return fmt.Errorf("invalid selection")
			}
			selected = []setup.Configurer{agents[idx-1]}
		}
		for _, cfg := range selected {
			installHook(cfg)
		}
		return nil
	}

	cfg, ok := setup.Get(h.Agent)
	if !ok {
		names := make([]string, 0)
		for _, c := range setup.All() {
			names = append(names, c.Name())
		}
		return fmt.Errorf("unknown agent %q (available: %s)", h.Agent, strings.Join(names, ", "))
	}
	installHook(cfg)
	return nil
}

type ConfigModeCmd struct {
	Mode string `arg:"" optional:"" help:"Mode to set (observe or enforce)."`
}

func (m *ConfigModeCmd) Run() error {
	if m.Mode == "" {
		engine, err := paths.LoadPolicy()
		if err != nil {
			return err
		}
		p := engine.Policy()
		ui.Info("current mode: " + ui.Boldf("%s", p.Mode))
		ui.Break()
		return nil
	}

	if m.Mode != "observe" && m.Mode != "enforce" {
		return fmt.Errorf("invalid mode %q: must be \"observe\" or \"enforce\"", m.Mode)
	}

	path, err := paths.PolicyFile()
	if err != nil {
		return err
	}
	if err := policy.SetMode(path, m.Mode); err != nil {
		return err
	}

	ui.Success("mode set to " + ui.Boldf("%s", m.Mode))
	ui.Break()
	return nil
}
