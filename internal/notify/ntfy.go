package notify

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
)

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
