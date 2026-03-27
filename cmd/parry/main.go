package main

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/alecthomas/kong"
	"github.com/google/uuid"
	"github.com/kkd16/parry/configs"
	_ "github.com/kkd16/parry/internal/agents"
	"github.com/kkd16/parry/internal/check"
	"github.com/kkd16/parry/internal/dashboard"
	"github.com/kkd16/parry/internal/notify"
	"github.com/kkd16/parry/internal/policy"
	"github.com/kkd16/parry/internal/setup"
	"github.com/kkd16/parry/internal/shellparse"
	"github.com/kkd16/parry/internal/store"
	"github.com/kkd16/parry/internal/ui"
	"golang.org/x/term"
)

var version = "dev"

func parryDir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("finding home directory: %w", err)
	}
	return filepath.Join(home, ".parry"), nil
}

func loadPolicy() (*policy.Engine, error) {
	engine := policy.NewEngine()
	dir, err := parryDir()
	if err != nil {
		return nil, err
	}
	path := filepath.Join(dir, "policy.yaml")
	if _, err := os.Stat(path); err == nil {
		return engine, engine.Load(path)
	}
	return engine, engine.LoadBytes(configs.DefaultPolicy)
}

type CLI struct {
	Check     CheckCmd     `cmd:"" help:"Evaluate a tool call from stdin against policy."`
	Init      InitCmd      `cmd:"" help:"Initialize Parry configuration."`
	Setup     SetupCmd     `cmd:"" help:"Configure Parry hooks in your agent."`
	Notify    NotifyCmd    `cmd:"" help:"Manage notifications."`
	Report    ReportCmd    `cmd:"" help:"Show observe mode report."`
	Validate  ValidateCmd  `cmd:"" help:"Validate policy YAML for errors."`
	Dashboard DashboardCmd `cmd:"" help:"Start the web dashboard."`
	Nuke      NukeCmd      `cmd:"" help:"Remove all Parry config, data, and policy."`
	Version   VersionCmd   `cmd:"" help:"Print version."`
}

func fatal(err error) {
	ui.Error(err.Error())
	os.Exit(check.ExitBlock)
}

type verdict struct {
	action  string
	respond string
	message string
}

func resolveVerdict(p *policy.Policy, action policy.Action) verdict {
	if p.Mode == "observe" {
		return verdict{"observe", "allow", ""}
	}
	switch action {
	case policy.Allow:
		return verdict{"allow", "allow", ""}
	case policy.Confirm:
		return resolveVerdict(p, p.CheckModeConfirm)
	default:
		return verdict{"block", "deny", "Blocked by Parry"}
	}
}

type CheckCmd struct{}

func (c *CheckCmd) Run() error {
	tc, agent, err := check.ParseInput(os.Stdin)
	if err != nil {
		fatal(err)
	}

	engine, err := loadPolicy()
	if err != nil {
		fatal(err)
	}

	action, tier, err := engine.Evaluate(tc.Tool, tc.ToolInput)
	if err != nil {
		fatal(err)
	}

	p := engine.Policy()

	var v verdict
	if action == policy.Confirm && p.NotificationsEnabled() && p.Mode == "enforce" {
		v = confirmViaNotify(p, tc, tier)
	} else {
		v = resolveVerdict(p, action)
	}

	if v.respond != "deny" && p.RateLimit != nil && p.Mode == "enforce" {
		if s, err := openStore(); err == nil {
			defer func() { _ = s.Close() }()
			window := p.RateLimit.ParseWindow()
			event := buildEvent(tc, int(tier), v.action, p.Mode)
			count, err := s.CountAndRecord(store.Session(), time.Now().UTC().Add(-window), event)
			if err != nil {
				fmt.Fprintf(os.Stderr, "parry: db: %v\n", err)
			} else if count >= p.RateLimit.Max {
				v = verdict{
					action:  string(p.RateLimit.OnExceed),
					respond: "deny",
					message: fmt.Sprintf("Rate limit exceeded: %d/%d in %s", count, p.RateLimit.Max, p.RateLimit.Window),
				}
			}
		} else {
			recordEvent(tc, int(tier), v.action, p.Mode)
		}
	} else {
		recordEvent(tc, int(tier), v.action, p.Mode)
	}

	cmd, _ := tc.ToolInput["command"].(string)
	if cmd == "" {
		cmd = tc.RawName
	}

	ui.LogCheck(v.action, cmd, int(tier))
	if err := agent.Respond(os.Stdout, check.Result{Decision: v.respond, Message: v.message}); err != nil {
		fmt.Fprintf(os.Stderr, "parry: encoding response: %v\n", err)
		os.Exit(check.ExitBlock)
	}
	return nil
}

func openStore() (*store.Store, error) {
	dir, err := parryDir()
	if err != nil {
		return nil, err
	}
	return store.Open(filepath.Join(dir, "parry.db"))
}

func buildEvent(tc *check.ToolCall, tier int, action, mode string) store.Event {
	e := store.Event{
		ToolName:  string(tc.Tool),
		ToolInput: tc.ToolInput,
		Tier:      tier,
		Action:    action,
		Session:   store.Session(),
		Mode:      mode,
		RawName:   tc.RawName,
		Workdir:   store.Workdir(),
	}
	if cmd, ok := tc.ToolInput["command"].(string); ok && cmd != "" {
		cmds := shellparse.Parse(cmd)
		if len(cmds) > 0 {
			e.Binary = cmds[0].Binary
			e.Subcommand = cmds[0].Subcommand
		}
	}
	if p, ok := tc.ToolInput["path"].(string); ok {
		e.File = p
	}
	return e
}

func recordEventWithStore(s *store.Store, tc *check.ToolCall, tier int, action, mode string) {
	if err := s.RecordEvent(buildEvent(tc, tier, action, mode)); err != nil {
		fmt.Fprintf(os.Stderr, "parry: db: %v\n", err)
	}
}

func recordEvent(tc *check.ToolCall, tier int, action, mode string) {
	s, err := openStore()
	if err != nil {
		fmt.Fprintf(os.Stderr, "parry: db: %v\n", err)
		return
	}
	defer func() { _ = s.Close() }()
	recordEventWithStore(s, tc, tier, action, mode)
}

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
	ui.Info("step 2/2: notifications")
	fmt.Println("   Approve or deny tool calls from your phone via push notifications.")
	fmt.Println()
	fmt.Println("   [1] ntfy")
	fmt.Println("   [s] skip")
	fmt.Println()
	fmt.Print("   select: ")
	choice := readChoice()

	if choice != "1" {
		return
	}

	topic := "parry-" + uuid.NewString()[:8]
	if err := enableNtfyInPolicy(policyPath, topic, "https://ntfy.sh"); err != nil {
		ui.Error(fmt.Sprintf("configuring notifications: %v", err))
		return
	}

	confirmer := &notify.NtfyConfirmer{Server: "https://ntfy.sh", Topic: topic}
	if err := confirmer.SendTest(context.Background()); err != nil {
		ui.Warn(fmt.Sprintf("test notification failed: %v", err))
		ui.Info("notifications configured, but verify your connection")
	} else {
		ui.Success("test notification sent")
	}

	printSubscribeInstructions(topic, "https://ntfy.sh")
}

func enableNtfyInPolicy(policyPath, topic, server string) error {
	raw, err := os.ReadFile(policyPath)
	if err != nil {
		return err
	}
	updated := strings.Replace(string(raw), `provider: ""`, `provider: ntfy`, 1)
	updated = strings.Replace(updated, `topic: ""`, fmt.Sprintf("topic: %s", topic), 1)
	return os.WriteFile(policyPath, []byte(updated), 0o644)
}

func printSubscribeInstructions(topic, server string) {
	ui.Detail("topic", topic)
	ui.Detail("server", server)
	ui.Break()
	ui.Info("subscribe on your phone:")
	ui.Detail("1", "Install ntfy (Android/iOS)")
	ui.Detail("2", fmt.Sprintf("Subscribe to topic: %s", topic))
	ui.Break()
}

type SetupCmd struct {
	Agent string `arg:"" help:"Agent to configure (claude or cursor)." enum:"claude,cursor"`
}

func (s *SetupCmd) Run() error {
	dir, err := parryDir()
	if err != nil {
		return err
	}
	policyPath := filepath.Join(dir, "policy.yaml")
	if _, err := os.Stat(policyPath); os.IsNotExist(err) {
		ui.Info("initializing parry first...")
		init := &InitCmd{}
		if err := init.Run(); err != nil {
			return fmt.Errorf("auto-init: %w", err)
		}
	}

	cfg, ok := setup.Get(s.Agent)
	if !ok {
		return fmt.Errorf("unknown agent: %s", s.Agent)
	}

	installHook(cfg)
	return nil
}

type DashboardCmd struct {
	Addr string `name:"addr" short:"a" default:":7777" help:"Listen address (e.g. :7777 or 127.0.0.1:7777)."`
}

func (d *DashboardCmd) Run() error {
	dir, err := parryDir()
	if err != nil {
		return err
	}
	dbPath := filepath.Join(dir, "parry.db")
	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		ui.Info("no data yet — run some commands with " + ui.Boldf("parry check") + " first")
		ui.Break()
		return nil
	}

	srv, err := dashboard.New(dbPath, d.Addr)
	if err != nil {
		return fmt.Errorf("starting dashboard: %w", err)
	}
	defer func() { _ = srv.Close() }()

	ui.Success("dashboard running")
	ui.Detail("url", "http://localhost"+d.Addr)
	ui.Break()

	return srv.Run()
}

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

type ReportCmd struct{}

func (r *ReportCmd) Run() error {
	dir, err := parryDir()
	if err != nil {
		return err
	}
	dbPath := filepath.Join(dir, "parry.db")
	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		ui.Info("no data yet — run some commands with " + ui.Boldf("parry check") + " first")
		ui.Break()
		return nil
	}

	s, err := store.Open(dbPath)
	if err != nil {
		return fmt.Errorf("opening database: %w", err)
	}
	defer func() { _ = s.Close() }()

	sum, err := s.Report()
	if err != nil {
		return fmt.Errorf("generating report: %w", err)
	}

	ui.Info(fmt.Sprintf("report — %d events recorded", sum.Total))
	ui.Break()

	ui.SectionHeader("Actions")
	for _, action := range []string{"observe", "allow", "block"} {
		if c, ok := sum.ByAction[action]; ok {
			var val string
			switch action {
			case "allow":
				val = ui.Greenf("%d", c)
			case "block":
				val = ui.Redf("%d", c)
			case "observe":
				val = ui.Yellowf("%d", c)
			}
			ui.Detail("  "+action, val)
		}
	}

	ui.Separator()
	ui.SectionHeader("Tiers")
	for tier := 1; tier <= 5; tier++ {
		if c, ok := sum.ByTier[tier]; ok {
			var val string
			switch {
			case tier <= 1:
				val = ui.Greenf("%d", c)
			case tier <= 2:
				val = ui.Bluef("%d", c)
			case tier <= 4:
				val = ui.Yellowf("%d", c)
			default:
				val = ui.Redf("%d", c)
			}
			ui.Detail(fmt.Sprintf("  T%d", tier), val)
		}
	}

	if len(sum.TopCommands) > 0 {
		ui.Separator()
		ui.SectionHeader("Top Commands")
		for _, tc := range sum.TopCommands {
			cmd := tc.Command
			if len(cmd) > 50 {
				cmd = cmd[:47] + "..."
			}
			ui.Detail("  "+cmd, fmt.Sprintf("×%d", tc.Count))
		}
	}

	ui.Break()
	return nil
}

type ValidateCmd struct{}

func (v *ValidateCmd) Run() error {
	dir, err := parryDir()
	if err != nil {
		return err
	}
	path := filepath.Join(dir, "policy.yaml")
	if _, err := os.Stat(path); os.IsNotExist(err) {
		ui.Error("no policy found — run " + ui.Boldf("parry init") + " first")
		ui.Break()
		return fmt.Errorf("no policy file at %s", path)
	}
	engine := policy.NewEngine()
	if err := engine.Load(path); err != nil {
		ui.Error("policy is broken")
		ui.Detail("error", err.Error())
		ui.Break()
		return err
	}

	p := engine.Policy()
	ui.Success("policy looks good")
	ui.Detail("file", path)
	ui.Detail("mode", p.Mode)
	ui.Detail("rules", fmt.Sprintf("%d", len(p.Rules)))

	binaries := 0
	for _, r := range p.Rules {
		binaries += len(r.Binaries)
	}
	ui.Detail("binaries", fmt.Sprintf("%d classified", binaries))
	ui.Detail("parry paths", fmt.Sprintf("%d protected", len(p.ParryPaths)))
	ui.Detail("user paths", fmt.Sprintf("%d protected", len(p.ProtectedPaths)))
	ui.Break()
	return nil
}

func confirmViaNotify(p *policy.Policy, tc *check.ToolCall, tier policy.Tier) verdict {
	confirmer := &notify.NtfyConfirmer{
		Server: p.Notifications.Ntfy.Server,
		Topic:  p.Notifications.Ntfy.Topic,
	}

	timeout := p.Notifications.ParseTimeout()
	ctx, cancel := context.WithTimeout(context.Background(), timeout)
	defer cancel()

	cmd, _ := tc.ToolInput["command"].(string)
	if cmd == "" {
		cmd = tc.RawName
	}

	ui.Info(fmt.Sprintf("waiting for confirmation (%s timeout)...", timeout))

	approved, err := confirmer.Confirm(ctx, notify.ConfirmRequest{
		Tool:    string(tc.Tool),
		RawName: tc.RawName,
		Command: cmd,
		Tier:    int(tier),
	})

	if err != nil {
		fmt.Fprintf(os.Stderr, "parry: notify: %v\n", err)
		return resolveVerdict(p, p.CheckModeConfirm)
	}
	if approved {
		return verdict{"allow", "allow", ""}
	}
	return verdict{"block", "deny", "Denied via notification"}
}

type NotifyCmd struct {
	Setup NotifySetupCmd `cmd:"" help:"Configure notification settings."`
	Test  NotifyTestCmd  `cmd:"" help:"Send a test notification."`
}

type NotifySetupCmd struct {
	Topic  string `name:"topic" short:"t" help:"ntfy topic name (generated if omitted)."`
	Server string `name:"server" short:"s" default:"https://ntfy.sh" help:"ntfy server URL."`
}

func (n *NotifySetupCmd) Run() error {
	engine, err := loadPolicy()
	if err != nil {
		return err
	}
	p := engine.Policy()

	if p.NotificationsEnabled() {
		ui.Info("notifications already configured")
		ui.Detail("provider", p.Notifications.Provider)
		ui.Detail("topic", p.Notifications.Ntfy.Topic)
		ui.Detail("server", p.Notifications.Ntfy.Server)
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

	topic := n.Topic
	if topic == "" {
		if term.IsTerminal(int(os.Stdin.Fd())) {
			generated := "parry-" + uuid.NewString()[:8]
			fmt.Printf("   topic [%s]: ", generated)
			_, _ = fmt.Scanln(&topic)
			if topic == "" {
				topic = generated
			}
		} else {
			topic = "parry-" + uuid.NewString()[:8]
		}
	}

	dir, err := parryDir()
	if err != nil {
		return err
	}
	policyPath := filepath.Join(dir, "policy.yaml")

	if err := enableNtfyInPolicy(policyPath, topic, n.Server); err != nil {
		return err
	}

	confirmer := &notify.NtfyConfirmer{Server: n.Server, Topic: topic}
	if err := confirmer.SendTest(context.Background()); err != nil {
		ui.Warn(fmt.Sprintf("test notification failed: %v", err))
	} else {
		ui.Success("test notification sent")
	}

	ui.Success("notifications configured")
	printSubscribeInstructions(topic, n.Server)
	return nil
}

type NotifyTestCmd struct{}

func (n *NotifyTestCmd) Run() error {
	engine, err := loadPolicy()
	if err != nil {
		return err
	}
	p := engine.Policy()

	if !p.NotificationsEnabled() {
		ui.Error("notifications not configured")
		ui.Info("run " + ui.Boldf("%s", "parry notify setup") + " first")
		ui.Break()
		return fmt.Errorf("notifications not configured")
	}

	confirmer := &notify.NtfyConfirmer{
		Server: p.Notifications.Ntfy.Server,
		Topic:  p.Notifications.Ntfy.Topic,
	}
	if err := confirmer.SendTest(context.Background()); err != nil {
		return err
	}

	ui.Success("test notification sent")
	ui.Detail("topic", p.Notifications.Ntfy.Topic)
	ui.Break()
	return nil
}

type VersionCmd struct{}

func (v *VersionCmd) Run() error {
	fmt.Printf("\n %s parry %s\n\n", ui.Bluef("⟐"), ui.Boldf("v%s", version))
	return nil
}

func main() {
	var cli CLI
	ctx := kong.Parse(&cli,
		kong.Name("parry"),
		kong.Description("Runtime security enforcement for AI agents."),
		kong.UsageOnError(),
	)
	err := ctx.Run()
	ctx.FatalIfErrorf(err)
}
