package main

import (
	"fmt"
	"log"
	"os"

	"github.com/kkd16/parry/internal/dashboard"
	"github.com/kkd16/parry/internal/paths"
	"github.com/kkd16/parry/internal/ui"
)

type DashboardCmd struct {
	Port  int  `name:"port" short:"p" default:"8080" help:"Port to listen on."`
	Debug bool `name:"debug" short:"d" help:"Print HTTP requests and debug info to stderr."`
}

func (d *DashboardCmd) Run() error {
	policyPath, err := paths.PolicyFile()
	if err != nil {
		return err
	}
	if _, err := os.Stat(policyPath); os.IsNotExist(err) {
		ui.Warn("parry is not initialized")
		ui.Info("run " + ui.Boldf("parry init") + " before starting the dashboard")
		ui.Break()
		return fmt.Errorf("parry not initialized: missing %s", policyPath)
	}
	dbPath, err := paths.DBFile()
	if err != nil {
		return err
	}

	var opts []dashboard.Option
	if d.Debug {
		opts = append(opts, dashboard.WithLogger(log.New(os.Stderr, "dashboard: ", log.LstdFlags)))
	}

	addr := fmt.Sprintf(":%d", d.Port)
	srv, err := dashboard.New(dbPath, addr, opts...)
	if err != nil {
		return fmt.Errorf("starting dashboard: %w", err)
	}
	defer func() { _ = srv.Close() }()

	ui.Success("dashboard running")
	ui.Detail("url", fmt.Sprintf("http://localhost:%d", d.Port))
	if d.Debug {
		ui.Detail("debug", "enabled")
	}
	ui.Break()

	return srv.Run()
}
