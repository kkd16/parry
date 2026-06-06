import { motion, AnimatePresence } from "motion/react";
import { useEffect, type ReactNode } from "react";
import "./Drawer.css";

interface Props {
  open: boolean;
  onClose: () => void;
  eyebrow: ReactNode;
  title: ReactNode;
  bodyKey?: string;
  children: ReactNode;
}

export default function Drawer({ open, onClose, eyebrow, title, bodyKey, children }: Props) {
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
            className="drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          <motion.aside
            className="drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
          >
            <div className="drawer-header">
              <div>
                <div className="drawer-eyebrow">{eyebrow}</div>
                <h2 className="drawer-title">{title}</h2>
              </div>
              <button className="drawer-close" onClick={onClose}>
                close · esc
              </button>
            </div>
            <div className="drawer-body" key={bodyKey}>
              {children}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
