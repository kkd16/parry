package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/kkd16/parry/configs"
	"github.com/kkd16/parry/internal/notify"
	"github.com/kkd16/parry/internal/setup"
	"github.com/kkd16/parry/internal/ui"
	"golang.org/x/term"
)

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

	if term.IsTerminal(int(os.Stdin.Fd())) {
		wizardHooks()
		wizardNotifications(policyPath)
	}

	return nil
}

func readChoice() string {
	var s string
	_, _ = fmt.Scanln(&s)
	return strings.TrimSpace(s)
}

func wizardHooks() {
	agents := setup.All()
	if len(agents) == 0 {
		return
	}

	ui.Info("step 1/2: hook setup")
	fmt.Println("   Install parry hooks so your agent checks every tool call.")
	fmt.Println()
	for i, a := range agents {
		fmt.Printf("   [%d] %s\n", i+1, a.Name())
	}
	fmt.Println("   [a] all")
	fmt.Println("   [s] skip")
	fmt.Println()
	fmt.Print("   select: ")
	choice := readChoice()

	var selected []setup.Configurer
	switch choice {
	case "s", "S", "":
		return
	case "a", "A":
		selected = agents
	default:
		idx := 0
		if _, err := fmt.Sscanf(choice, "%d", &idx); err != nil || idx < 1 || idx > len(agents) {
			ui.Warn("invalid selection, skipping")
			ui.Break()
			return
		}
		selected = []setup.Configurer{agents[idx-1]}
	}

	for _, cfg := range selected {
		installHook(cfg)
	}
}

func installHook(cfg setup.Configurer) {
	configPath, err := cfg.ConfigPath()
	if err != nil {
		ui.Error(fmt.Sprintf("%s: %v", cfg.Name(), err))
		return
	}

	data, err := setup.ReadJSONFile(configPath)
	if err != nil {
		ui.Error(fmt.Sprintf("%s: %v", cfg.Name(), err))
		return
	}

	if cfg.IsInstalled(data) {
		ui.Info("parry hook already configured for " + cfg.Name())
		ui.Detail("config", configPath)
		ui.Break()
		return
	}

	data = cfg.Inject(data)
	if err := setup.WriteJSONFile(configPath, data); err != nil {
		ui.Error(fmt.Sprintf("%s: %v", cfg.Name(), err))
		return
	}

	ui.Success("parry hook installed for " + cfg.Name())
	ui.Detail("config", configPath)
	ui.Break()
}

func wizardNotifications(policyPath string) {
	providers := notify.AllProviders()
	if len(providers) == 0 {
		return
	}

	ui.Info("step 2/2: notifications")
	fmt.Println("   Approve or deny tool calls from your phone via push notifications.")
	fmt.Println()
	for i, p := range providers {
		fmt.Printf("   [%d] %s\n", i+1, p.Name())
	}
	fmt.Println("   [s] skip")
	fmt.Println()
	fmt.Print("   select: ")
	choice := readChoice()

	if choice == "s" || choice == "S" || choice == "" {
		return
	}

	idx := 0
	if _, err := fmt.Sscanf(choice, "%d", &idx); err != nil || idx < 1 || idx > len(providers) {
		ui.Warn("invalid selection, skipping")
		ui.Break()
		return
	}

	result, err := providers[idx-1].RunSetup(policyPath)
	if err != nil {
		ui.Error(fmt.Sprintf("notification setup failed: %v", err))
		return
	}
	renderSetupResult(result)
}
