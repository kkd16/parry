import { motion, AnimatePresence } from "motion/react";
import { useEffect, type ReactNode } from "react";
import clsx from "clsx";
import { Eyebrow } from "./ui";

interface Props {
  open: boolean;
  onClose: () => void;
  eyebrow: ReactNode;
  title: ReactNode;
  bodyKey?: string;
  children: ReactNode;
}

export const yamlBlockCls =
  "my-3 rounded border border-rule-soft bg-bg p-3 text-meta leading-normal whitespace-pre-wrap wrap-break-word text-ink";

export const drawerSectionCls =
  "mt-5.5 border-t border-dashed border-rule-soft pt-4";

export const drawerLabelCls =
  "text-micro tracking-label text-ink-mute uppercase";

export function DrawerField({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-3.5 border-b border-dashed border-rule-soft py-2.5 text-body">
      <div className={clsx("min-w-25 pt-0.75", drawerLabelCls)}>{label}</div>
      <div className="flex-1 text-body break-all text-ink">{children}</div>
    </div>
  );
}

export function DrawerActions({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={clsx(
        "mt-4.5 flex flex-wrap gap-2 border-t border-dashed border-rule-soft pt-3.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export default function Drawer({
  open,
  onClose,
  eyebrow,
  title,
  bodyKey,
  children,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-80 bg-scrim/65 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.aside
            className="fixed inset-y-0 right-0 z-90 flex w-[min(560px,90vw)] flex-col border-l border-rule bg-bg-raised shadow-[-20px_0_60px_rgba(0,0,0,0.5)]"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-rule px-8 pt-7 pb-5">
              <div>
                <Eyebrow>{eyebrow}</Eyebrow>
                <h2 className="font-display text-[2rem] leading-none font-bold text-ink italic">
                  {title}
                </h2>
              </div>
              <button
                className="shrink-0 rounded border border-rule px-2 py-1 text-meta text-ink-dim hover:border-brass hover:text-brass focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-brass"
                onClick={onClose}
              >
                close · esc
              </button>
            </div>
            <div
              className="flex-1 overflow-y-auto px-8 pt-6 pb-8"
              key={bodyKey}
            >
              {children}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
