package main

import (
	"fmt"

	"github.com/kkd16/parry/configs"
	"github.com/kkd16/parry/internal/eval"
	"github.com/kkd16/parry/internal/policy"
)

type EvalCmd struct {
	Corpus string `name:"corpus" help:"Path to corpus directory" default:"testdata/eval"`
}

func (e *EvalCmd) Run() error {
	engine := policy.NewEngine()
	if err := engine.LoadBytes(configs.DefaultPolicy); err != nil {
		return fmt.Errorf("loading embedded default policy: %w", err)
	}

	entries, err := eval.Load(e.Corpus)
	if err != nil {
		return err
	}

	summary := eval.Run(engine, entries)
	eval.Print(summary)

	if summary.Fail > 0 || summary.Errored > 0 {
		return fmt.Errorf("eval: %d failed, %d errored", summary.Fail, summary.Errored)
	}
	return nil
}
