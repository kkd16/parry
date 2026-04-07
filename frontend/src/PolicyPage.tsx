import { actionBadge } from "./policyBadges";
import type { Rule } from "./types";
import type { PolicyOverviewState } from "./usePolicyOverview";

function ruleBindings(rule: Rule): { action: string; binaries: string[] }[] {
  const rows: { action: string; binaries: string[] }[] = [];
  if (rule.allow?.length) rows.push({ action: "allow", binaries: rule.allow });
  if (rule.confirm?.length) rows.push({ action: "confirm", binaries: rule.confirm });
  if (rule.block?.length) rows.push({ action: "block", binaries: rule.block });
  return rows;
}

export default function PolicyPage({
  policy,
  loading,
  error,
}: PolicyOverviewState) {
  if (loading) return <div className="policy-loading">Loading policy...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!policy) return null;

  const shell = policy.rules["shell"];
  const fileEdit = policy.rules["file_edit"];
  const fileRead = policy.rules["file_read"];

  return (
    <div className="policy-grid">
      <div className="policy-card">
        <h2>Defaults</h2>
        <div className="policy-field">
          <span className="policy-label">Default Action</span>
          <span className="policy-value">{actionBadge(policy.default_action)}</span>
        </div>
        <div className="policy-field">
          <span className="policy-label">Check-Mode Confirm</span>
          <span className="policy-value">{actionBadge(policy.check_mode_confirm)}</span>
        </div>
      </div>

      {shell && (
        <div className="policy-card full-width">
          <h2>Shell Rules</h2>
          <div className="policy-field">
            <span className="policy-label">Default Action</span>
            <span className="policy-value">{actionBadge(shell.default_action ?? policy.default_action)}</span>
          </div>
          <table className="policy-table">
            <thead>
              <tr>
                <th>Action</th>
                <th>Binaries</th>
              </tr>
            </thead>
            <tbody>
              {ruleBindings(shell).map(({ action, binaries }) => (
                <tr key={action}>
                  <td>{actionBadge(action)}</td>
                  <td><span className="mono">{binaries.join(", ")}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="policy-card">
        <h2>File Rules</h2>
        <div className="policy-field">
          <span className="policy-label">file_edit default</span>
          <span className="policy-value">{actionBadge(fileEdit?.default_action ?? policy.default_action)}</span>
        </div>
        <div className="policy-field">
          <span className="policy-label">file_read default</span>
          <span className="policy-value">{actionBadge(fileRead?.default_action ?? policy.default_action)}</span>
        </div>
      </div>

      <div className="policy-card">
        <h2>Rate Limit</h2>
        {policy.rate_limit ? (
          <>
            <div className="policy-field">
              <span className="policy-label">Window</span>
              <span className="policy-value mono">{policy.rate_limit.window}</span>
            </div>
            <div className="policy-field">
              <span className="policy-label">Max</span>
              <span className="policy-value">{policy.rate_limit.max}</span>
            </div>
            {policy.rate_limit.on_exceed && (
              <div className="policy-field">
                <span className="policy-label">On Exceed</span>
                <span className="policy-value">{actionBadge(policy.rate_limit.on_exceed)}</span>
              </div>
            )}
          </>
        ) : (
          <span className="muted">Not configured</span>
        )}
      </div>

      <div className="policy-card">
        <h2>Protected Paths</h2>
        {policy.protected_paths?.length ? (
          <ul className="path-list">
            {policy.protected_paths.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : (
          <span className="muted">None</span>
        )}
      </div>

      <div className="policy-card">
        <h2>Parry Paths</h2>
        {policy.parry_paths?.length ? (
          <ul className="path-list">
            {policy.parry_paths.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        ) : (
          <span className="muted">None</span>
        )}
      </div>
    </div>
  );
}
