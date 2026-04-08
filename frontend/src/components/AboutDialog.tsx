import { motion, AnimatePresence } from "motion/react";
import { useEffect, useState } from "react";
import { useToast } from "./Toasts";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface AboutInfo {
  version: string;
  go_version: string;
  commit: string;
  built: string;
  platform: string;
  data_dir: string;
}

function CopyBtn({ value }: { value: string }) {
  const toast = useToast();
  if (!value) return null;
  return (
    <button
      className="copy-btn"
      onClick={() => {
        void navigator.clipboard.writeText(value);
        toast.success("copied", value);
      }}
    >
      copy
    </button>
  );
}

export default function AboutDialog({ open, onClose }: Props) {
  const [info, setInfo] = useState<AboutInfo | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void fetch("/api/about")
      .then((r) => r.json())
      .then((d: AboutInfo) => {
        if (!cancelled) setInfo(d);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="cmdk-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={onClose}
        >
          <motion.div
            className="shortcuts-dialog about-dialog"
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", damping: 28, stiffness: 360 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="shortcuts-header">
              <div className="shortcuts-eyebrow">about</div>
              <h2 className="shortcuts-title about-title">
                Parry
                <span className="about-version">v{info?.version ?? "…"}</span>
              </h2>
            </div>
            <div className="shortcuts-body about-body">
              <div className="about-row">
                <span className="about-row-label">go</span>
                <span className="about-row-value mono">{info?.go_version || "—"}</span>
              </div>
              <div className="about-row">
                <span className="about-row-label">commit</span>
                <span className="about-row-value mono">
                  {info?.commit || <span className="muted">unknown</span>}
                  {info?.commit && <CopyBtn value={info.commit} />}
                </span>
              </div>
              <div className="about-row">
                <span className="about-row-label">built</span>
                <span className="about-row-value mono">
                  {info?.built || <span className="muted">unknown</span>}
                </span>
              </div>
              <div className="about-row">
                <span className="about-row-label">platform</span>
                <span className="about-row-value mono">{info?.platform || "—"}</span>
              </div>
              <div className="about-row">
                <span className="about-row-label">data dir</span>
                <span className="about-row-value mono">
                  {info?.data_dir || <span className="muted">—</span>}
                  {info?.data_dir && <CopyBtn value={info.data_dir} />}
                </span>
              </div>
            </div>
            <div className="shortcuts-footer about-footer">
              <span className="about-tagline">your agent decides · parry enforces</span>
              <a href="https://github.com/kkd16/parry" target="_blank" rel="noreferrer">
                github.com/kkd16/parry
              </a>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
