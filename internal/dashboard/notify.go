package dashboard

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/kkd16/parry/internal/notify"
)

func (s *Server) handleNotifyHealth(w http.ResponseWriter, _ *http.Request) {
	p, err := loadPolicy()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	if !p.NotificationsEnabled() {
		writeJSON(w, http.StatusOK, map[string]string{"status": "unconfigured"})
		return
	}

	cfg := p.Notifications.ProviderConfig()
	topic, _ := cfg["topic"].(string)
	server, _ := cfg["server"].(string)
	if server == "" {
		server = "https://ntfy.sh"
	}

	result := map[string]string{
		"status":   "ok",
		"provider": p.Notifications.Provider,
		"topic":    topic,
		"server":   server,
	}

	if topic == "" {
		result["status"] = "error"
		result["error"] = "no topic configured"
		writeJSON(w, http.StatusOK, result)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	url := strings.TrimRight(server, "/") + "/" + topic + "/json?poll=1&since=" + strconv.FormatInt(time.Now().Unix(), 10)
	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		result["status"] = "error"
		result["error"] = err.Error()
		writeJSON(w, http.StatusOK, result)
		return
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		result["status"] = "error"
		result["error"] = "unreachable"
		writeJSON(w, http.StatusOK, result)
		return
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode != http.StatusOK {
		result["status"] = "error"
		result["error"] = fmt.Sprintf("ntfy returned %d", resp.StatusCode)
		writeJSON(w, http.StatusOK, result)
		return
	}

	writeJSON(w, http.StatusOK, result)
}

func (s *Server) handleNotifyTest(w http.ResponseWriter, _ *http.Request) {
	p, err := loadPolicy()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	if !p.NotificationsEnabled() {
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":    false,
			"error": "no notification provider configured",
		})
		return
	}

	provider, ok := notify.GetProvider(p.Notifications.Provider)
	if !ok {
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":    false,
			"error": "unknown provider: " + p.Notifications.Provider,
		})
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := provider.SendTest(ctx, p.Notifications.ProviderConfig()); err != nil {
		writeJSON(w, http.StatusOK, map[string]any{
			"ok":      false,
			"error":   err.Error(),
			"sent_at": time.Now().UTC().Format(time.RFC3339),
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"sent_at": time.Now().UTC().Format(time.RFC3339),
	})
}
