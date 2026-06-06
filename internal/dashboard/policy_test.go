package dashboard

import (
	"errors"
	"net/http"
	"testing"

	"github.com/kkd16/parry/internal/policy"
	"github.com/stretchr/testify/require"
)

func TestHandlePolicyEvaluate(t *testing.T) {
	srv := newTestServer(t)
	h := srv.routes()

	t.Run("shell block with matched stage", func(t *testing.T) {
		rec, body := doJSONBody(t, h, http.MethodPost, "/api/policy/evaluate",
			`{"tool":"shell","tool_input":{"command":"rm -rf /tmp/x"}}`)
		require.Equal(t, http.StatusOK, rec.Code)
		require.Equal(t, "block", body["action"])
		require.Equal(t, "shell", body["tool"])

		cmds := requireJSONArray(t, body, "commands")
		require.Len(t, cmds, 1)
		stage := cmds[0].(map[string]any)
		require.Equal(t, "rm", stage["binary"])
		require.Equal(t, "block", stage["action"])
		matched := stage["matched"].(map[string]any)
		require.Equal(t, false, matched["is_default"])
		entry := matched["entry"].(map[string]any)
		require.Equal(t, "rm", entry["binary"])
	})

	t.Run("shorthand command defaults to shell", func(t *testing.T) {
		rec, body := doJSONBody(t, h, http.MethodPost, "/api/policy/evaluate", `{"command":"git status"}`)
		require.Equal(t, http.StatusOK, rec.Code)
		require.Equal(t, "allow", body["action"])
		require.Equal(t, "shell", body["tool"])
	})

	t.Run("protected path reported", func(t *testing.T) {
		rec, body := doJSONBody(t, h, http.MethodPost, "/api/policy/evaluate",
			`{"tool":"file_read","tool_input":{"path":"/etc/shadow"}}`)
		require.Equal(t, http.StatusOK, rec.Code)
		require.Equal(t, "block", body["action"])
		hit := body["protected"].(map[string]any)
		require.Equal(t, "/etc/shadow", hit["pattern"])
		require.Equal(t, "/etc/shadow", hit["arg"])
	})

	t.Run("unresolved syntax reported", func(t *testing.T) {
		rec, body := doJSONBody(t, h, http.MethodPost, "/api/policy/evaluate", `{"command":"cat $VAR"}`)
		require.Equal(t, http.StatusOK, rec.Code)
		require.Equal(t, "block", body["action"])
		require.Equal(t, true, body["unresolved"])
	})

	t.Run("unknown tool rejected", func(t *testing.T) {
		rec, body := doJSONBody(t, h, http.MethodPost, "/api/policy/evaluate",
			`{"tool":"unknown","tool_input":{}}`)
		require.Equal(t, http.StatusBadRequest, rec.Code)
		require.Contains(t, body["error"], "tool must be one of")
	})

	t.Run("empty body rejected", func(t *testing.T) {
		rec, body := doJSONBody(t, h, http.MethodPost, "/api/policy/evaluate", `{}`)
		require.Equal(t, http.StatusBadRequest, rec.Code)
		require.Contains(t, body["error"], "tool must be one of")
	})

	t.Run("malformed JSON rejected", func(t *testing.T) {
		rec, body := doJSONBody(t, h, http.MethodPost, "/api/policy/evaluate", `{nope`)
		require.Equal(t, http.StatusBadRequest, rec.Code)
		require.Contains(t, body["error"], "invalid JSON body")
	})

	t.Run("policy load failure is 500", func(t *testing.T) {
		broken := newTestServer(t)
		broken.policyLoader = func() (*policy.Policy, error) { return nil, errors.New("boom") }
		rec, body := doJSONBody(t, broken.routes(), http.MethodPost, "/api/policy/evaluate", `{"command":"ls"}`)
		require.Equal(t, http.StatusInternalServerError, rec.Code)
		require.Equal(t, "boom", body["error"])
	})
}
