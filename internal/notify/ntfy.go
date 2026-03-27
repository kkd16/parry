package notify

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/kkd16/parry/internal/ui"
)

func init() {
	Register(&ntfyProvider{})
}

type ntfyProvider struct{}

func (p *ntfyProvider) Name() string { return "ntfy" }

func (p *ntfyProvider) NewConfirmer(cfg map[string]any) (Confirmer, error) {
	topic, _ := cfg["topic"].(string)
	if topic == "" {
		return nil, fmt.Errorf("ntfy: topic is required")
	}
	server, _ := cfg["server"].(string)
	if server == "" {
		server = "https://ntfy.sh"
	}
	return &NtfyConfirmer{Server: server, Topic: topic}, nil
}

func (p *ntfyProvider) SendTest(ctx context.Context, cfg map[string]any) error {
	c, err := p.NewConfirmer(cfg)
	if err != nil {
		return err
	}
	return c.(*NtfyConfirmer).SendTest(ctx)
}

func (p *ntfyProvider) RunSetup(policyPath string) error {
	topic := "parry-" + uuid.NewString()[:8]
	server := "https://ntfy.sh"

	if err := enableInPolicy(policyPath, "ntfy", topic, server); err != nil {
		ui.Error(fmt.Sprintf("configuring notifications: %v", err))
		return err
	}

	confirmer := &NtfyConfirmer{Server: server, Topic: topic}
	if err := confirmer.SendTest(context.Background()); err != nil {
		ui.Warn(fmt.Sprintf("test notification failed: %v", err))
		ui.Info("notifications configured, but verify your connection")
	} else {
		ui.Success("test notification sent")
	}

	ui.Detail("topic", topic)
	ui.Detail("server", server)
	ui.Break()
	ui.Info("subscribe on your phone:")
	ui.Detail("1", "Install ntfy (Android/iOS)")
	ui.Detail("2", fmt.Sprintf("Subscribe to topic: %s", topic))
	ui.Break()
	return nil
}

func enableInPolicy(policyPath, provider, topic, server string) error {
	raw, err := os.ReadFile(policyPath)
	if err != nil {
		return err
	}
	updated := strings.Replace(string(raw), `provider: ""`, fmt.Sprintf("provider: %s", provider), 1)
	updated = strings.Replace(updated, `topic: ""`, fmt.Sprintf("topic: %s", topic), 1)
	return os.WriteFile(policyPath, []byte(updated), 0o644)
}

type NtfyConfirmer struct {
	Server string
	Topic  string
}

func (n *NtfyConfirmer) topicURL() string {
	return strings.TrimRight(n.Server, "/") + "/" + n.Topic
}

func (n *NtfyConfirmer) Confirm(ctx context.Context, req ConfirmRequest) (bool, error) {
	reqID := uuid.NewString()[:8]
	since := time.Now().Unix()

	if err := n.publish(ctx, reqID, req); err != nil {
		return false, fmt.Errorf("publishing notification: %w", err)
	}

	return n.waitForResponse(ctx, reqID, since)
}

func (n *NtfyConfirmer) publish(ctx context.Context, reqID string, req ConfirmRequest) error {
	body := fmt.Sprintf("%s (T%d)", req.Command, req.Tier)

	approveAction := fmt.Sprintf("http, Approve, %s, method=POST, body=approve:%s", n.topicURL(), reqID)
	denyAction := fmt.Sprintf("http, Deny, %s, method=POST, body=deny:%s", n.topicURL(), reqID)
	actions := approveAction + "; " + denyAction

	httpReq, err := http.NewRequestWithContext(ctx, "POST", n.topicURL(), strings.NewReader(body))
	if err != nil {
		return err
	}
	httpReq.Header.Set("Title", fmt.Sprintf("parry: confirm %s?", req.Tool))
	httpReq.Header.Set("Tags", "warning")
	httpReq.Header.Set("Actions", actions)

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("ntfy returned %d", resp.StatusCode)
	}
	return nil
}

func (n *NtfyConfirmer) waitForResponse(ctx context.Context, reqID string, since int64) (bool, error) {
	approveBody := "approve:" + reqID
	denyBody := "deny:" + reqID

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return false, nil
		case <-ticker.C:
			msgs, err := n.poll(ctx, since)
			if err != nil {
				continue
			}
			for _, msg := range msgs {
				if msg.Message == approveBody {
					return true, nil
				}
				if msg.Message == denyBody {
					return false, nil
				}
			}
		}
	}
}

type ntfyMessage struct {
	Event   string `json:"event"`
	Message string `json:"message"`
	Time    int64  `json:"time"`
}

func (n *NtfyConfirmer) poll(ctx context.Context, since int64) ([]ntfyMessage, error) {
	url := fmt.Sprintf("%s/json?poll=1&since=%d", n.topicURL(), since)

	req, err := http.NewRequestWithContext(ctx, "GET", url, nil)
	if err != nil {
		return nil, err
	}

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var msgs []ntfyMessage
	dec := json.NewDecoder(resp.Body)
	for dec.More() {
		var msg ntfyMessage
		if err := dec.Decode(&msg); err != nil {
			break
		}
		if msg.Event == "message" {
			msgs = append(msgs, msg)
		}
	}
	return msgs, nil
}

func (n *NtfyConfirmer) SendTest(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, "POST", n.topicURL(),
		strings.NewReader("If you see this, ntfy is working with parry."))
	if err != nil {
		return err
	}
	req.Header.Set("Title", "parry test notification")
	req.Header.Set("Tags", "white_check_mark")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("sending test notification: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("ntfy returned %d", resp.StatusCode)
	}
	return nil
}
