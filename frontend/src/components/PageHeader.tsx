import clsx from "clsx";

interface Props {
  eyebrow?: string;
  title: string;
  sub?: string;
  flush?: boolean;
  className?: string;
  titleClassName?: string;
}

export default function PageHeader({
  eyebrow,
  title,
  sub,
  flush,
  className,
  titleClassName,
}: Props) {
  return (
    <header className={clsx("animate-fade-up", !flush && "mb-9", className)}>
      {eyebrow && (
        <div className="mb-2.5 text-micro tracking-eyebrow text-brass uppercase">
          {eyebrow}
        </div>
      )}
      <h1
        className={clsx(
          "mb-3.5 font-display text-[3.6rem] leading-none font-bold tracking-[-0.015em] text-ink italic",
          titleClassName,
        )}
      >
        {title}
      </h1>
      {sub && <div className="text-body text-ink-dim">{sub}</div>}
      <div
        className="flex max-w-80 items-center gap-1.5 before:h-px before:flex-1 before:bg-rule before:content-[''] after:h-px after:flex-1 after:bg-rule after:content-['']"
        aria-hidden
      >
        <span className="h-1 w-1 shrink-0 rounded-full bg-brass" />
      </div>
    </header>
  );
}
