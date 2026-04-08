package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/kkd16/parry/internal/check"
	"github.com/kkd16/parry/internal/runtime"
	"github.com/kkd16/parry/internal/paths"
	"github.com/kkd16/parry/internal/ui"
)

type CheckCmd struct{}

func (c *CheckCmd) Run() error {
	tc, agent, err := check.ParseInput(os.Stdin)
	if err != nil {
		fatal(err)
	}

	engine, err := paths.LoadPolicy()
	if err != nil {
		fatal(err)
	}

	dir, err := paths.Dir()
	if err != nil {
		fatal(err)
	}
	rt := runtime.New(engine, filepath.Join(dir, "parry.db"))
	v := rt.Decide(context.Background(), tc)

	cmd, _ := tc.ToolInput["command"].(string)
	if cmd == "" {
		cmd = tc.RawName
	}

	ui.LogCheck(v.Action, cmd)
	if err := agent.Respond(os.Stdout, check.Result{Decision: v.Respond, Message: v.Message}); err != nil {
		fmt.Fprintf(os.Stderr, "parry: encoding response: %v\n", err)
		os.Exit(check.ExitBlock)
	}
	return nil
}
