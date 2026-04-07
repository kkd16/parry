import { actionBadge, modeBadge } from "./policyBadges";
import type { NotifyHealth, Policy } from "./types";

export interface PolicyOverviewBarProps {
  policy: Policy | null;
  health: NotifyHealth | null;
  loading: boolean;
  error: string | null;
}

export default function PolicyOverviewBar({
  policy,
  health,
  loading,
  error,
}: PolicyOverviewBarProps) {
  if (loading) {
    return (
      <div className="navbar-overview">
        <span className="muted">Loading policy…</span>
      </div>
    );
  }
  if (error) {
    return (
      <div className="navbar-overview">
        <span className="navbar-overview-error" title={error}>
          {error}
        </span>
      </div>
    );
  }
  if (!policy) {
    return (
      <div className="navbar-overview">
        <span className="muted">No policy</span>
      </div>
    );
  }

  const n = policy.notifications;

  return (
    <div className="navbar-overview">
      <div className="navbar-overview-group" aria-label="General">
        <span className="navbar-overview-item">
          <span className="navbar-overview-label">Mode</span>
          {modeBadge(policy.mode)}
        </span>
        <span className="navbar-overview-item">
          <span className="navbar-overview-label">Ver</span>
          <span className="navbar-overview-value">{policy.version}</span>
        </span>
        <span className="navbar-overview-item">
          <span className="navbar-overview-label">Default</span>
          {actionBadge(policy.default_action)}
        </span>
        <span className="navbar-overview-item">
          <span className="navbar-overview-label">Confirm</span>
          {actionBadge(policy.check_mode_confirm)}
        </span>
      </div>
      <span className="navbar-overview-sep" aria-hidden />
      <div className="navbar-overview-group" aria-label="Notifications">
        {n?.provider ? (
          <>
            <span className="navbar-overview-item">
              <span className="navbar-overview-label">Notify</span>
              <span className="navbar-overview-value">{n.provider}</span>
            </span>
            {health && (
              <span className="navbar-overview-item">
                <span className="navbar-overview-label">Status</span>
                <span className="navbar-overview-value">
                  {health.status === "ok" && (
                    <span className="badge badge-allow">connected</span>
                  )}
                  {health.status === "error" && (
                    <span className="badge badge-block">unreachable</span>
                  )}
                  {health.status === "unconfigured" && (
                    <span className="muted">not configured</span>
                  )}
                </span>
              </span>
            )}
            {health?.status === "error" && health.error && (
              <span
                className="navbar-overview-item navbar-overview-item-wide"
                title={health.error}
              >
                <span className="navbar-overview-label">Error</span>
                <span className="navbar-overview-value muted mono navbar-overview-truncate">
                  {health.error}
                </span>
              </span>
            )}
            {health?.topic && (
              <span className="navbar-overview-item">
                <span className="navbar-overview-label">Topic</span>
                <span className="navbar-overview-value mono navbar-overview-truncate">
                  {health.topic}
                </span>
              </span>
            )}
            {health?.server && (
              <span className="navbar-overview-item">
                <span className="navbar-overview-label">Server</span>
                <span className="navbar-overview-value mono navbar-overview-truncate">
                  {health.server}
                </span>
              </span>
            )}
            {n.confirmation_timeout && (
              <span className="navbar-overview-item">
                <span className="navbar-overview-label">Timeout</span>
                <span className="navbar-overview-value mono">
                  {n.confirmation_timeout}
                </span>
              </span>
            )}
          </>
        ) : (
          <span className="navbar-overview-item">
            <span className="navbar-overview-label">Notify</span>
            <span className="muted">Not configured</span>
          </span>
        )}
      </div>
    </div>
  );
}
