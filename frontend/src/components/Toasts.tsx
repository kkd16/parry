import { motion, AnimatePresence } from "motion/react";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import clsx from "clsx";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";

type ToastKind = "success" | "error";

interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  detail?: string;
}

interface Ctx {
  success: (title: string, detail?: string) => void;
  error: (title: string, detail?: string) => void;
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
      success: (t, d) => show("success", t, d),
      error: (t, d) => show("error", t, d),
    }),
    [show],
  );

  return (
    <ToastsContext.Provider value={ctx}>
      {children}
      <div className="pointer-events-none fixed right-6 bottom-6 z-200 flex flex-col gap-2.5">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              className={clsx(
                "pointer-events-auto flex max-w-100 min-w-70 items-start gap-3 rounded border border-l-3 border-rule bg-bg-raised px-3.5 py-3 text-meta shadow-float",
                t.kind === "success" ? "border-l-allow" : "border-l-block",
              )}
              initial={{ opacity: 0, x: 40, scale: 0.96 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 40, scale: 0.96 }}
              transition={{ type: "spring", damping: 26, stiffness: 360 }}
              layout
            >
              <span
                className={clsx(
                  "mt-px shrink-0",
                  t.kind === "success" ? "text-allow" : "text-block",
                )}
              >
                {t.kind === "success" ? (
                  <CheckCircle2 size={16} />
                ) : (
                  <AlertTriangle size={16} />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <div className="font-medium text-ink">{t.title}</div>
                {t.detail && (
                  <div className="mt-0.5 text-tiny text-ink-mute">
                    {t.detail}
                  </div>
                )}
              </div>
              <button
                className="text-ink-mute focus-ring hover:text-brass"
                onClick={() => remove(t.id)}
              >
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
