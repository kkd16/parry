package dashboard

import (
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strings"

	"github.com/kkd16/parry/internal/policy"
	"github.com/kkd16/parry/internal/shellparse"
	"github.com/kkd16/parry/internal/store"
)

type ruleSuggestion struct {
	Tool      string `json:"tool"`
	Action    string `json:"action"`
	YAML      string `json:"yaml"`
	Duplicate bool   `json:"duplicate"`
	Warning   string `json:"warning,omitempty"`
}

func (s *Server) handleRuleSuggestion(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	eventID := intParam(q.Get("event_id"), 0, 0, 1_000_000_000)
	if eventID <= 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "event_id is required"})
		return
	}

	action := policy.Action(q.Get("action"))
	if !isSuggestionAction(action) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "action must be allow, confirm, or block"})
		return
	}

	ev, err := s.store.GetEvent(eventID)
	if errors.Is(err, sql.ErrNoRows) {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "event not found"})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	p, err := s.loadPolicy()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	suggestion := suggestRule(ev, p, action)
	writeJSON(w, http.StatusOK, suggestion)
}

func suggestRule(ev *store.EventRow, p *policy.Policy, action policy.Action) ruleSuggestion {
	tool := ev.CanonicalTool()
	switch tool {
	case "shell":
		return suggestShellRule(ev, p, action)
	case "file_read", "file_edit":
		return suggestFileRule(ev, p, action, tool)
	default:
		return ruleSuggestion{
			Tool:    tool,
			Action:  string(action),
			YAML:    fmt.Sprintf("# No precise policy rule can be suggested for %q yet.\n", ev.ToolName),
			Warning: "Parry does not have structured rules for this tool type yet.",
		}
	}
}

func suggestShellRule(ev *store.EventRow, p *policy.Policy, action policy.Action) ruleSuggestion {
	cmd := suggestionCommand(ev, p, action)
	if hasShellCommandText(ev) {
		if suggestion, ok := preRuleShellSuggestion(cmd, action, p); ok {
			return suggestion
		}
	}

	entry := policy.RuleEntry{Binary: cmd.Binary}
	if entry.Binary == "" {
		return ruleSuggestion{
			Tool:    "shell",
			Action:  string(action),
			YAML:    "# No shell binary was captured for this event.\n",
			Warning: "A shell rule needs a binary name.",
		}
	}

	entry.Positional = suggestedPositionals(p, entry.Binary, cmd.Positional)
	entry.Flags = suggestedSemanticFlags(p, entry.Binary, cmd)

	return ruleSuggestion{
		Tool:      "shell",
		Action:    string(action),
		YAML:      shellRuleYAML(action, entry),
		Duplicate: p.ShellCommandAction(cmd) == action,
		Warning:   shellWarning(entry),
	}
}

func hasShellCommandText(ev *store.EventRow) bool {
	command, _ := ev.ToolInput["command"].(string)
	return command != ""
}

func preRuleShellSuggestion(cmd shellparse.Command, action policy.Action, p *policy.Policy) (ruleSuggestion, bool) {
	if !cmd.Resolved {
		return ruleSuggestion{
			Tool:      "shell",
			Action:    string(action),
			YAML:      "# No precise policy rule can be suggested for this shell command.\n",
			Duplicate: action == policy.Block,
			Warning:   "This command contains unresolved shell syntax; Parry blocks it before binary rules are evaluated.",
		}, true
	}

	if path, ok := commandProtectedPath(cmd, p); ok {
		if action == policy.Block {
			yaml := "protected_paths:\n  - " + yamlScalar(path) + "\n"
			return ruleSuggestion{
				Tool:      "shell",
				Action:    string(action),
				YAML:      yaml,
				Duplicate: true,
				Warning:   "protected_paths applies before shell rules.",
			}, true
		}
		return ruleSuggestion{
			Tool:      "shell",
			Action:    string(action),
			YAML:      "# No shell allow/confirm rule can override protected_paths for this command.\n",
			Duplicate: false,
			Warning:   "This command touches a protected path; protected_paths is evaluated before shell rules.",
		}, true
	}

	return ruleSuggestion{}, false
}

func commandProtectedPath(cmd shellparse.Command, p *policy.Policy) (string, bool) {
	for _, arg := range cmd.Positional {
		if arg != "" && p.AnyPathProtected([]string{arg}) {
			return arg, true
		}
	}
	return "", false
}

func suggestionCommand(ev *store.EventRow, p *policy.Policy, action policy.Action) shellparse.Command {
	command, _ := ev.ToolInput["command"].(string)
	if command == "" {
		return shellparse.Command{Binary: ev.Binary, Resolved: ev.Binary != ""}
	}
	cmds := shellparse.Parse(command)
	if len(cmds) == 0 {
		return shellparse.Command{Binary: ev.Binary, Resolved: ev.Binary != ""}
	}

	triggerAction := policy.Action(ev.Action)
	if !isSuggestionAction(triggerAction) {
		triggerAction = action
	}
	if cmd, ok := commandForAction(cmds, p, triggerAction); ok {
		return cmd
	}

	for _, cmd := range cmds {
		if cmd.Binary == ev.Binary {
			return cmd
		}
	}
	return cmds[0]
}

func commandForAction(cmds []shellparse.Command, p *policy.Policy, action policy.Action) (shellparse.Command, bool) {
	if action == policy.Block {
		for _, cmd := range cmds {
			if !cmd.Resolved {
				return cmd, true
			}
			if _, ok := commandProtectedPath(cmd, p); ok {
				return cmd, true
			}
		}
	}

	for _, cmd := range cmds {
		if p.ShellCommandAction(cmd) == action {
			return cmd, true
		}
	}
	return shellparse.Command{}, false
}

func positionalPrefix(rule, cmd []string) bool {
	if len(rule) > len(cmd) {
		return false
	}
	for i := range rule {
		if rule[i] != cmd[i] {
			return false
		}
	}
	return true
}

func isSuggestionAction(action policy.Action) bool {
	return action == policy.Allow || action == policy.Confirm || action == policy.Block
}

func suggestedPositionals(p *policy.Policy, binary string, positional []string) []string {
	if len(positional) == 0 {
		return nil
	}
	rule := p.Rules["shell"]
	if rule == nil {
		return nil
	}

	var best []string
	for _, entry := range rule.Entries() {
		if entry.Binary != binary || len(entry.Positional) == 0 {
			continue
		}
		if len(entry.Positional) > len(best) && positionalPrefix(entry.Positional, positional) {
			best = entry.Positional
		}
	}
	if len(best) > 0 {
		return append([]string(nil), best...)
	}
	return nil
}

func suggestedSemanticFlags(p *policy.Policy, binary string, cmd shellparse.Command) []string {
	rule := p.Rules["shell"]
	if rule == nil || rule.FlagEquivalents == nil {
		return nil
	}
	equivalents := rule.FlagEquivalents[binary]
	if len(equivalents) == 0 {
		return nil
	}

	names := make([]string, 0, len(equivalents))
	for name := range equivalents {
		names = append(names, name)
	}
	sort.Strings(names)

	var out []string
	for _, name := range names {
		for _, form := range equivalents[name] {
			short, long := shellparse.ClassifyFlagForm(form)
			if short != "" && cmd.ShortFlags[short] {
				out = append(out, name)
				break
			}
			if long != "" && cmd.LongFlags[long] {
				out = append(out, name)
				break
			}
		}
	}
	return out
}

func shellRuleYAML(action policy.Action, entry policy.RuleEntry) string {
	var b strings.Builder
	b.WriteString("rules:\n")
	b.WriteString("  shell:\n")
	b.WriteString("    " + string(action) + ":\n")
	b.WriteString("      - binary: " + yamlScalar(entry.Binary) + "\n")
	if len(entry.Positional) > 0 {
		b.WriteString("        positional: " + yamlInlineList(entry.Positional) + "\n")
	}
	if len(entry.Flags) > 0 {
		b.WriteString("        flags: " + yamlInlineList(entry.Flags) + "\n")
	}
	return b.String()
}

func shellWarning(entry policy.RuleEntry) string {
	if len(entry.Positional) == 0 && len(entry.Flags) == 0 {
		return "This rule applies to every invocation of this binary."
	}
	return ""
}

func suggestFileRule(ev *store.EventRow, p *policy.Policy, action policy.Action, tool string) ruleSuggestion {
	target := fileSuggestionTarget(ev)

	if action == policy.Block && target != "" {
		yaml := "protected_paths:\n  - " + yamlScalar(target) + "\n"
		return ruleSuggestion{
			Tool:      tool,
			Action:    string(action),
			YAML:      yaml,
			Duplicate: fileActionCovered(p, tool, action, target),
			Warning:   "protected_paths applies across shell, file reads, and file edits.",
		}
	}

	yaml := "rules:\n  " + tool + ":\n    default_action: " + string(action) + "\n"
	warning := "File rules currently support only default actions; this applies to every " + tool + " event."
	if target == "" {
		warning = "No file path was captured. " + warning
	}
	return ruleSuggestion{
		Tool:      tool,
		Action:    string(action),
		YAML:      yaml,
		Duplicate: fileActionCovered(p, tool, action, target),
		Warning:   warning,
	}
}

func fileSuggestionTarget(ev *store.EventRow) string {
	if ev.File != "" {
		return ev.File
	}
	if path, _ := ev.ToolInput["path"].(string); path != "" {
		return path
	}
	glob, _ := ev.ToolInput["glob"].(string)
	return glob
}

func fileActionCovered(p *policy.Policy, tool string, action policy.Action, target string) bool {
	if target != "" && p.AnyPathProtected([]string{target}) {
		return action == policy.Block
	}
	return p.ToolDefaultAction(tool) == action
}

func yamlInlineList(values []string) string {
	parts := make([]string, 0, len(values))
	for _, v := range values {
		parts = append(parts, yamlScalar(v))
	}
	return "[" + strings.Join(parts, ", ") + "]"
}

func yamlScalar(s string) string {
	return fmt.Sprintf("%q", s)
}
