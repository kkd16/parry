import clsx from "clsx";
import type { ComponentProps } from "react";
import { badgeVariants, healthClass, healthDotVariants } from "./variants";

export const inputCls =
  "rounded border border-rule bg-bg px-2.5 py-1.5 font-mono text-body text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:italic placeholder:text-ink-mute focus:border-brass focus:ring-2 focus:ring-brass/15";

export const btnCls =
  "inline-flex items-center gap-1.5 rounded border border-rule bg-bg px-3 py-1.5 font-mono text-meta tracking-widest text-ink uppercase transition-colors duration-150 hover:border-brass hover:text-brass-bright focus-ring [&_svg]:size-3.25";

export const chipBtnCls =
  "inline-flex items-center gap-1 rounded border border-rule px-2 py-0.5 font-mono text-micro tracking-widest text-ink-mute uppercase hover:border-brass hover:text-brass focus-ring";

export function Btn({
  active,
  className,
  ...rest
}: ComponentProps<"button"> & { active?: boolean }) {
  return (
    <button
      className={clsx(
        btnCls,
        active && "border-brass bg-brass/8 text-brass-bright",
        className,
      )}
      {...rest}
    />
  );
}

export function Card({ className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      className={clsx(
        "rounded-md border border-rule bg-bg-raised px-5.5 py-5 shadow-panel",
        className,
      )}
      {...rest}
    />
  );
}

export function Eyebrow({ className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      className={clsx(
        "mb-3 font-mono text-eyebrow tracking-eyebrow text-brass uppercase",
        className,
      )}
      {...rest}
    />
  );
}

export function Badge({
  action,
  className,
  ...rest
}: ComponentProps<"span"> & { action?: string }) {
  return (
    <span
      className={clsx(
        "inline-block rounded-sm border px-2 py-0.5 font-mono text-micro font-semibold tracking-widest uppercase",
        badgeVariants[action ?? ""] ?? "border-transparent",
        className,
      )}
      {...rest}
    />
  );
}

export function Kbd({ className, ...rest }: ComponentProps<"span">) {
  return (
    <span
      className={clsx(
        "rounded border border-rule bg-bg-raised px-1.5 py-px font-mono text-micro text-ink-dim",
        className,
      )}
      {...rest}
    />
  );
}

export function HealthDot({
  status,
  className,
}: {
  status?: string;
  className?: string;
}) {
  const key = healthClass(status);
  return (
    <span
      className={clsx(
        "mr-1.5 inline-block size-1.75 rounded-full align-middle",
        healthDotVariants[key],
        className,
      )}
    />
  );
}

export function Muted({
  className,
  children = "—",
  ...rest
}: ComponentProps<"span">) {
  return (
    <span className={clsx("text-ink-mute italic", className)} {...rest}>
      {children}
    </span>
  );
}

export function EmptyState({ className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      className={clsx(
        "p-10 text-center font-display text-base text-ink-mute italic",
        className,
      )}
      {...rest}
    />
  );
}

export function FieldLabel({ className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      className={clsx(
        "font-mono text-micro tracking-label text-ink-mute uppercase",
        className,
      )}
      {...rest}
    />
  );
}

export function FieldValue({ className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      className={clsx("font-mono text-body text-ink", className)}
      {...rest}
    />
  );
}

export function ErrorBox({ className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      className={clsx(
        "mb-4 rounded border border-block/30 bg-block/12 px-4.5 py-3.5 font-mono text-body text-block",
        className,
      )}
      {...rest}
    />
  );
}
