import { getAbout } from "../api";
import { useApi } from "../hooks/useApi";
import CopyButton from "./CopyButton";
import Dialog from "./Dialog";
import { useToast } from "./Toasts";
import "./AboutDialog.css";

interface Props {
  open: boolean;
  onClose: () => void;
}

function CopyBtn({ value }: { value: string }) {
  const toast = useToast();
  if (!value) return null;
  return <CopyButton text={value} onCopied={() => toast.success("copied", value)} />;
}

function AboutContent() {
  const { data: info } = useApi(getAbout);

  return (
    <>
      <div className="shortcuts-header">
        <div className="shortcuts-eyebrow">about</div>
        <h2 className="shortcuts-title about-title">
          Parry
          <span className="about-version">v{info?.version ?? "…"}</span>
        </h2>
      </div>
      <div className="shortcuts-body about-body">
        <div className="field-row about-row">
          <span className="field-label">go</span>
          <span className="about-row-value mono">{info?.go_version || "—"}</span>
        </div>
        <div className="field-row about-row">
          <span className="field-label">commit</span>
          <span className="about-row-value mono">
            {info?.commit || <span className="muted">unknown</span>}
            {info?.commit && <CopyBtn value={info.commit} />}
          </span>
        </div>
        <div className="field-row about-row">
          <span className="field-label">built</span>
          <span className="about-row-value mono">
            {info?.built || <span className="muted">unknown</span>}
          </span>
        </div>
        <div className="field-row about-row">
          <span className="field-label">platform</span>
          <span className="about-row-value mono">{info?.platform || "—"}</span>
        </div>
        <div className="field-row about-row">
          <span className="field-label">data dir</span>
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
    </>
  );
}

export default function AboutDialog({ open, onClose }: Props) {
  return (
    <Dialog open={open} onClose={onClose} className="shortcuts-dialog about-dialog">
      <AboutContent />
    </Dialog>
  );
}
