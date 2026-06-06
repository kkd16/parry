export const badgeVariants: Record<string, string> = {
  allow: "border-allow/25 bg-allow/12 text-allow",
  block: "border-block/25 bg-block/12 text-block",
  observe: "border-observe/30 bg-observe/14 text-observe",
  confirm: "border-confirm/30 bg-confirm/14 text-confirm",
};

export const healthDotVariants: Record<string, string> = {
  ok: "bg-allow shadow-[0_0_6px_var(--color-allow)]",
  err: "bg-block shadow-[0_0_6px_var(--color-block)]",
  none: "bg-ink-mute",
};
