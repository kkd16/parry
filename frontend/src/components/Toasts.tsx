import { motion, AnimatePresence } from "motion/react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, AlertTriangle, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";

interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  detail?: string;
}

interface Ctx {
  show: (kind: ToastKind, title: string, detail?: string) => void;
  success: (title: string, detail?: string) => void;
  error: (title: string, detail?: string) => void;
  info: (title: string, detail?: string) => void;
}

const ToastsContext = createContext<Ctx | null>(null);

export function ToastsProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const remove = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const show = useCallback(
    (kind: ToastKind, title: string, detail?: string) => {
      const id = Date.now() + Math.random();
      setToasts((t) => [...t, { id, kind, title, detail }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove],
  );

  const ctx = useMemo<Ctx>(
    () => ({
      show,
      success: (t, d) => show("success", t, d),
      error: (t, d) => show("error", t, d),
      info: (t, d) => show("info", t, d),
    }),
    [show],
  );

  return (
    <ToastsContext.Provider value={ctx}>
      {children}
      <div className="toast-stack">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              className={`toast toast-${t.kind}`}
              initial={{ opacity: 0, x: 40, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.96 }}
              transition={{ type: "spring", damping: 26, stiffness: 360 }}
              layout
            >
              <span className="toast-icon">
                {t.kind === "success" && <CheckCircle2 size={16} />}
                {t.kind === "error" && <AlertTriangle size={16} />}
                {t.kind === "info" && <Info size={16} />}
              </span>
              <div className="toast-body">
                <div className="toast-title">{t.title}</div>
                {t.detail && <div className="toast-detail">{t.detail}</div>}
              </div>
              <button className="toast-close" onClick={() => remove(t.id)}>
                <X size={12} />
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast(): Ctx {
  const ctx = useContext(ToastsContext);
  if (!ctx) throw new Error("useToast must be used inside ToastsProvider");
  return ctx;
}
