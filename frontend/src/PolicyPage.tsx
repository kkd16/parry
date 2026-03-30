import { useEffect, useState } from "react";
import type { Policy, Rule, NotifyHealth } from "./types";

function actionBadge(action: string): React.ReactNode {
  let cls = "badge";
  switch (action) {
    case "allow":
      cls += " badge-allow";
      break;
    case "block":
      cls += " badge-block";
      break;
    case "confirm":
      cls += " badge-observe";
      break;
  }
  return <span className={cls}>{action}</span>;
}

function modeBadge(mode: string): React.ReactNode {
  const cls = mode === "enforce" ? "badge badge-block" : "badge badge-allow";
  return <span className={cls}>{mode}</span>;
}

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

export default function PolicyPage() {
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [health, setHealth] = useState<NotifyHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/policy");
        if (!res.ok) throw new Error(await res.text());
        setPolicy(await res.json());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    })();
    (async () => {
      try {
        const res = await fetch("/api/notify/health");
        if (res.ok) setHealth(await res.json());
      } catch {
        // health check is best-effort
      }
    })();
  }, []);

  if (loading) return <div className="policy-loading">Loading policy...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!policy) return null;

  const shell = policy.rules["shell"];
  const fileEdit = policy.rules["file_edit"];
  const fileRead = policy.rules["file_read"];

  return (
    <div className="policy-grid">
      <div className="policy-card">
        <h2>General</h2>
        <div className="policy-field">
          <span className="policy-label">Mode</span>
          <span className="policy-value">{modeBadge(policy.mode)}</span>
        </div>
        <div className="policy-field">
          <span className="policy-label">Version</span>
          <span className="policy-value">{policy.version}</span>
        </div>
        <div className="policy-field">
          <span className="policy-label">Default Tier</span>
          <span className="policy-value">T{policy.default_tier}</span>
        </div>
        <div className="policy-field">
          <span className="policy-label">Confirm Fallback</span>
          <span className="policy-value">{actionBadge(policy.check_mode_confirm)}</span>
        </div>
      </div>

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

      <div className="policy-card">
        <h2>Notifications</h2>
        {policy.notifications?.provider ? (
          <>
            <div className="policy-field">
              <span className="policy-label">Provider</span>
              <span className="policy-value">{policy.notifications.provider}</span>
            </div>
            {health && (
              <div className="policy-field">
                <span className="policy-label">Status</span>
                <span className="policy-value">
                  {health.status === "ok" && <span className="badge badge-allow">connected</span>}
                  {health.status === "error" && (
                    <span className="badge badge-block">unreachable</span>
                  )}
                  {health.status === "unconfigured" && (
                    <span className="muted">not configured</span>
                  )}
                </span>
              </div>
            )}
            {health?.status === "error" && health.error && (
              <div className="policy-field">
                <span className="policy-label">Error</span>
                <span className="policy-value muted">{health.error}</span>
              </div>
            )}
            {health?.topic && (
              <div className="policy-field">
                <span className="policy-label">Topic</span>
                <span className="policy-value mono">{health.topic}</span>
              </div>
            )}
            {health?.server && (
              <div className="policy-field">
                <span className="policy-label">Server</span>
                <span className="policy-value mono">{health.server}</span>
              </div>
            )}
            {policy.notifications.confirmation_timeout && (
              <div className="policy-field">
                <span className="policy-label">Timeout</span>
                <span className="policy-value mono">{policy.notifications.confirmation_timeout}</span>
              </div>
            )}
          </>
        ) : (
          <span className="muted">Not configured</span>
        )}
      </div>
    </div>
  );
}
