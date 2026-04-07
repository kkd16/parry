package main

import (
	"fmt"

	"github.com/kkd16/parry/internal/buildinfo"
	"github.com/kkd16/parry/internal/ui"
)

type VersionCmd struct{}

func (v *VersionCmd) Run() error {
	fmt.Printf("\n %s parry %s\n\n", ui.Bluef("⟐"), ui.Boldf("v%s", buildinfo.Version))
	return nil
}
