import { actionBadge } from "./policyBadges";
import type { Rule } from "./types";
import type { PolicyOverviewState } from "./usePolicyOverview";

function tierRows(tiers: Record<string, string>): [number, string][] {
  return Object.entries(tiers)
    .map(([k, v]) => [Number(k), v] as [number, string])
    .sort((a, b) => a[0] - b[0]);
}

function ruleBindings(rule: Rule): { tier: number; binaries: string[] }[] {
  const tiers: { tier: number; binaries: string[] }[] = [];
  if (rule.tier_1?.length) tiers.push({ tier: 1, binaries: rule.tier_1 });
  if (rule.tier_2?.length) tiers.push({ tier: 2, binaries: rule.tier_2 });
  if (rule.tier_3?.length) tiers.push({ tier: 3, binaries: rule.tier_3 });
  if (rule.tier_4?.length) tiers.push({ tier: 4, binaries: rule.tier_4 });
  if (rule.tier_5?.length) tiers.push({ tier: 5, binaries: rule.tier_5 });
  return tiers;
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
        <h2>Tier Actions</h2>
        <table className="policy-table">
          <thead>
            <tr>
              <th>Tier</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {tierRows(policy.tiers).map(([tier, action]) => (
              <tr key={tier}>
                <td>T{tier}</td>
                <td>{actionBadge(action)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {shell && (
        <div className="policy-card full-width">
          <h2>Shell Rules</h2>
          <div className="policy-field">
            <span className="policy-label">Default Tier</span>
            <span className="policy-value">T{shell.default_tier ?? policy.default_tier}</span>
          </div>
          <table className="policy-table">
            <thead>
              <tr>
                <th>Tier</th>
                <th>Binaries</th>
              </tr>
            </thead>
            <tbody>
              {ruleBindings(shell).map(({ tier, binaries }) => (
                <tr key={tier}>
                  <td>T{tier}</td>
                  <td><span className="mono">{binaries.join(", ")}</span></td>
                </tr>
              ))}
              {shell.block && shell.block.length > 0 && (
                <tr>
                  <td><span className="badge badge-block">block</span></td>
                  <td><span className="mono">{shell.block.join(", ")}</span></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <div className="policy-card">
        <h2>File Rules</h2>
        <div className="policy-field">
          <span className="policy-label">file_edit default</span>
          <span className="policy-value">T{fileEdit?.default_tier ?? policy.default_tier}</span>
        </div>
        <div className="policy-field">
          <span className="policy-label">file_read default</span>
          <span className="policy-value">T{fileRead?.default_tier ?? policy.default_tier}</span>
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
