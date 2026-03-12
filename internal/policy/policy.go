package policy

type Tier string

const (
	T1Observe     Tier = "T1_observe"
	T2LocalWrite  Tier = "T2_local_write"
	T3Destructive Tier = "T3_destructive"
	T4External    Tier = "T4_external"
	T5Credential  Tier = "T5_credential"
)

type Action string

const (
	Allow   Action = "allow"
	Block   Action = "block"
	Confirm Action = "confirm"
)

type Rule struct {
	Tier      Tier              `yaml:"tier,omitempty"`
	AllowList []string          `yaml:"allow_list,omitempty"`
	BlockList []string          `yaml:"block_list,omitempty"`
	BlockWhen map[string]string `yaml:"block_when,omitempty"`
}

type RateLimit struct {
	Scope    string `yaml:"scope"`
	Max      int    `yaml:"max"`
	Window   string `yaml:"window"`
	OnExceed Action `yaml:"on_exceed"`
}

type Policy struct {
	Version          int             `yaml:"version"`
	Mode             string          `yaml:"mode"`
	CheckModeConfirm Action          `yaml:"check_mode_confirm"`
	DefaultTier      Tier            `yaml:"default_tier"`
	Tiers            map[Tier]Action `yaml:"tiers"`
	Rules            map[string]Rule `yaml:"rules"`
	RateLimits       []RateLimit     `yaml:"rate_limits"`
}

type Engine struct {
	policy *Policy
}

func NewEngine() *Engine {
	return &Engine{}
}

func (e *Engine) Load(path string) error {
	// TODO: read YAML, parse, validate, store
	return nil
}

func (e *Engine) Evaluate(toolName string, toolInput map[string]any) (Action, Tier, error) {
	// TODO: classify tool, apply rules, check rate limits
	return Block, T3Destructive, nil
}
