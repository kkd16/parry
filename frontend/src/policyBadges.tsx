import type { ReactNode } from "react";

export const ACTION_COLORS: Record<string, string> = {
  allow: "var(--allow)",
  block: "var(--block)",
  observe: "var(--observe)",
  confirm: "var(--confirm)",
};

export function healthClass(status: string | undefined): string {
  return status === "ok" ? "ok" : status === "error" ? "err" : "none";
}

export function actionBadge(action: string): ReactNode {
  let cls = "badge";
  switch (action) {
    case "allow":
      cls += " badge-allow";
      break;
    case "block":
      cls += " badge-block";
      break;
    case "confirm":
      cls += " badge-confirm";
      break;
    case "observe":
      cls += " badge-observe";
      break;
  }
  return <span className={cls}>{action}</span>;
}

export function modeBadge(mode: string): ReactNode {
  const cls = mode === "enforce" ? "badge badge-block" : "badge badge-allow";
  return <span className={cls}>{mode}</span>;
}
