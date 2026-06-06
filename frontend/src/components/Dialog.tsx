import { motion, AnimatePresence } from "motion/react";
import type { ReactNode } from "react";

export const dialogPanelCls =
  "overflow-hidden rounded-lg border border-rule bg-bg-raised shadow-[0_40px_120px_rgba(0,0,0,0.65),0_0_0_1px_rgba(212,161,74,0.08)]";

export const dialogHeaderCls = "border-b border-rule px-7 pt-6 pb-4.5";

export const dialogTitleCls =
  "font-display text-[2rem] leading-none text-ink italic";

interface Props {
  open: boolean;
  onClose: () => void;
  className: string;
  children: ReactNode;
}

export default function Dialog({ open, onClose, className, children }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-100 flex items-start justify-center bg-[rgba(5,6,10,0.75)] pt-[14vh] backdrop-blur-[6px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
        >
          <motion.div
            className={className}
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", damping: 28, stiffness: 360 }}
            onClick={(e) => e.stopPropagation()}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
