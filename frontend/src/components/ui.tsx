import clsx from "clsx";
import type { ComponentProps } from "react";
import { badgeVariants, healthDotVariants } from "./variants";

export const inputCls =
  "rounded border border-rule bg-bg px-2.5 py-1.5 font-mono text-body text-ink outline-none transition-[border-color,box-shadow] duration-150 placeholder:italic placeholder:text-ink-mute focus:border-brass focus:shadow-[0_0_0_2px_rgba(212,161,74,0.15)]";

export const btnCls =
  "inline-flex items-center gap-1.5 rounded border border-rule bg-bg px-3 py-1.5 font-mono text-meta tracking-[0.08em] text-ink uppercase transition-all duration-150 hover:border-brass hover:text-brass-bright [&_svg]:h-[13px] [&_svg]:w-[13px]";

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
        "rounded-md border border-rule bg-bg-raised px-5.5 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.02),0_1px_0_rgba(0,0,0,0.3)]",
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
        "mb-3 font-mono text-eyebrow tracking-[0.22em] text-brass uppercase",
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
        "inline-block rounded-sm border px-2 py-0.5 font-mono text-[0.64rem] font-semibold tracking-[0.1em] uppercase",
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
        "rounded-[3px] border border-rule bg-bg-raised px-1.5 py-px font-mono text-micro text-ink-dim",
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
  const key = status === "ok" ? "ok" : status === "error" ? "err" : "none";
  return (
    <span
      className={clsx(
        "mr-1.5 inline-block h-[7px] w-[7px] rounded-full align-middle",
        healthDotVariants[key],
        className,
      )}
    />
  );
}

export function FieldLabel({ className, ...rest }: ComponentProps<"div">) {
  return (
    <div
      className={clsx(
        "font-mono text-[0.6rem] tracking-[0.14em] text-ink-mute uppercase",
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
