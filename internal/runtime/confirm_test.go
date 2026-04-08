package runtime

import (
	"context"
	"errors"
	"testing"

	"github.com/kkd16/parry/internal/check"
	"github.com/kkd16/parry/internal/notify"
	notifymocks "github.com/kkd16/parry/internal/notify/mocks"
	"github.com/kkd16/parry/internal/policy"
	"github.com/stretchr/testify/require"
	"go.uber.org/mock/gomock"
)

func notifyPolicy(providerName string, checkModeConfirm policy.Action) *policy.Policy {
	return &policy.Policy{
		Mode:             "enforce",
		CheckModeConfirm: checkModeConfirm,
		Notifications: &policy.Notifications{
			Provider:            providerName,
			ConfirmationTimeout: "5s",
		},
	}
}

func shellToolCall(cmd string) *check.ToolCall {
	return &check.ToolCall{
		Tool:      check.ToolShell,
		RawName:   "Bash",
		ToolInput: map[string]any{"command": cmd},
	}
}

func TestConfirmViaNotify_ProviderNotFound(t *testing.T) {
	p := notifyPolicy("nonexistent-runtime-provider", policy.Block)
	got := confirmViaNotify(context.Background(), p, shellToolCall("ls"))
	require.Equal(t, Verdict{Action: "block", Respond: "deny", Message: "Blocked by Parry"}, got)
}

func TestConfirmViaNotify_NewConfirmerError(t *testing.T) {
	ctrl := gomock.NewController(t)
	mp := notifymocks.NewMockProvider(ctrl)
	name := registerMockProvider(t, mp)
	mp.EXPECT().NewConfirmer(gomock.Any()).Return(nil, errors.New("nope"))

	p := notifyPolicy(name, policy.Block)
	got := confirmViaNotify(context.Background(), p, shellToolCall("ls"))
	require.Equal(t, Verdict{Action: "block", Respond: "deny", Message: "Blocked by Parry"}, got)
}

func TestConfirmViaNotify_Approved(t *testing.T) {
	name, mc := newMockConfirmer(t)

	var captured notify.ConfirmRequest
	mc.EXPECT().
		Confirm(gomock.Any(), gomock.AssignableToTypeOf(notify.ConfirmRequest{})).
		DoAndReturn(func(_ context.Context, req notify.ConfirmRequest) (bool, error) {
			captured = req
			return true, nil
		})

	p := notifyPolicy(name, policy.Block)
	got := confirmViaNotify(context.Background(), p, shellToolCall("ls -la"))
	require.Equal(t, Verdict{Action: "allow", Respond: "allow"}, got)

	require.Equal(t, "shell", captured.Tool)
	require.Equal(t, "Bash", captured.RawName)
	require.Equal(t, "ls -la", captured.Command)
}

func TestConfirmViaNotify_Denied(t *testing.T) {
	name, mc := newMockConfirmer(t)
	mc.EXPECT().Confirm(gomock.Any(), gomock.Any()).Return(false, nil)

	p := notifyPolicy(name, policy.Block)
	got := confirmViaNotify(context.Background(), p, shellToolCall("ls"))
	require.Equal(t, Verdict{Action: "block", Respond: "deny", Message: "Denied via notification"}, got)
}

func TestConfirmViaNotify_DeadlineExceeded(t *testing.T) {
	name, mc := newMockConfirmer(t)
	mc.EXPECT().Confirm(gomock.Any(), gomock.Any()).Return(false, context.DeadlineExceeded)

	p := notifyPolicy(name, policy.Block)
	got := confirmViaNotify(context.Background(), p, shellToolCall("ls"))
	require.Equal(t, Verdict{Action: "block", Respond: "deny", Message: "Blocked by Parry"}, got)
}

func TestConfirmViaNotify_GenericError(t *testing.T) {
	name, mc := newMockConfirmer(t)
	mc.EXPECT().Confirm(gomock.Any(), gomock.Any()).Return(false, errors.New("network down"))

	p := notifyPolicy(name, policy.Allow)
	got := confirmViaNotify(context.Background(), p, shellToolCall("ls"))
	require.Equal(t, Verdict{Action: "allow", Respond: "allow"}, got)
}

func TestConfirmViaNotify_CommandFallbackToRawName(t *testing.T) {
	name, mc := newMockConfirmer(t)

	var captured notify.ConfirmRequest
	mc.EXPECT().
		Confirm(gomock.Any(), gomock.AssignableToTypeOf(notify.ConfirmRequest{})).
		DoAndReturn(func(_ context.Context, req notify.ConfirmRequest) (bool, error) {
			captured = req
			return true, nil
		})

	tc := &check.ToolCall{
		Tool:      check.ToolFileEdit,
		RawName:   "Write",
		ToolInput: map[string]any{},
	}
	p := notifyPolicy(name, policy.Block)
	confirmViaNotify(context.Background(), p, tc)

	require.Equal(t, "Write", captured.Command)
}
