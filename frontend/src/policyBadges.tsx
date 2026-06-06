import type { ReactNode } from "react";
import { Badge } from "./components/ui";

export const ACTION_COLORS: Record<string, string> = {
  allow: "var(--color-allow)",
  block: "var(--color-block)",
  observe: "var(--color-observe)",
  confirm: "var(--color-confirm)",
};

export function healthClass(status: string | undefined): string {
  return status === "ok" ? "ok" : status === "error" ? "err" : "none";
}

export function actionBadge(action: string): ReactNode {
  return <Badge action={action}>{action}</Badge>;
}

export function modeBadge(mode: string): ReactNode {
  return <Badge action={mode === "enforce" ? "block" : "allow"}>{mode}</Badge>;
}
