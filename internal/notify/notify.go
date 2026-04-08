package notify

//go:generate mockgen -destination=mocks/provider.go -package=mocks github.com/kkd16/parry/internal/notify Provider,Confirmer

import (
	"context"
	"sort"
)

type ConfirmRequest struct {
	Tool    string
	RawName string
	Command string
}

type Confirmer interface {
	Confirm(ctx context.Context, req ConfirmRequest) (bool, error)
}

type Provider interface {
	Name() string
	NewConfirmer(cfg map[string]any) (Confirmer, error)
	SendTest(ctx context.Context, cfg map[string]any) error
	RunSetup(policyPath string) (SetupResult, error)
}

var providers = map[string]Provider{}

func Register(p Provider) {
	providers[p.Name()] = p
}

func GetProvider(name string) (Provider, bool) {
	p, ok := providers[name]
	return p, ok
}

func AllProviders() []Provider {
	out := make([]Provider, 0, len(providers))
	for _, p := range providers {
		out = append(out, p)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name() < out[j].Name() })
	return out
}

func ProviderNames() []string {
	all := AllProviders()
	names := make([]string, len(all))
	for i, p := range all {
		names[i] = p.Name()
	}
	return names
}
