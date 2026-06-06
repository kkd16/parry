import { getAbout } from "../api";
import { useApi } from "../hooks/useApi";
import CopyButton from "./CopyButton";
import Dialog, {
  dialogEyebrowCls,
  dialogHeaderCls,
  dialogPanelCls,
  dialogTitleCls,
} from "./Dialog";
import { FieldLabel } from "./ui";
import { useToast } from "./Toasts";
import clsx from "clsx";
import type { ReactNode } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
}

function CopyBtn({ value }: { value: string }) {
  const toast = useToast();
  if (!value) return null;
  return (
    <CopyButton text={value} onCopied={() => toast.success("copied", value)} />
  );
}

function AboutRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-dashed border-rule py-[9px] font-mono text-[0.76rem] last:border-b-0">
      <FieldLabel>{label}</FieldLabel>
      <span className="inline-flex items-center gap-2.5 text-right font-mono text-[0.75rem] break-all text-ink-dim">
        {children}
      </span>
    </div>
  );
}

function AboutContent() {
  const { data: info } = useApi(getAbout);

  return (
    <>
      <div className={dialogHeaderCls}>
        <div className={dialogEyebrowCls}>about</div>
        <h2 className={clsx(dialogTitleCls, "flex items-baseline gap-3.5")}>
          Parry
          <span className="font-mono text-body font-normal tracking-[0.04em] text-brass not-italic">
            v{info?.version ?? "…"}
          </span>
        </h2>
      </div>
      <div className="px-7 pt-4.5 pb-3.5">
        <AboutRow label="go">{info?.go_version || "—"}</AboutRow>
        <AboutRow label="commit">
          {info?.commit || (
            <span className="text-ink-mute italic">unknown</span>
          )}
          {info?.commit && <CopyBtn value={info.commit} />}
        </AboutRow>
        <AboutRow label="built">
          {info?.built || <span className="text-ink-mute italic">unknown</span>}
        </AboutRow>
        <AboutRow label="platform">{info?.platform || "—"}</AboutRow>
        <AboutRow label="data dir">
          {info?.data_dir || <span className="text-ink-mute italic">—</span>}
          {info?.data_dir && <CopyBtn value={info.data_dir} />}
        </AboutRow>
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-rule px-7 pt-3 pb-4 font-mono text-tiny text-ink-mute">
        <span className="font-display text-[0.92rem] text-ink-dim italic">
          your agent decides · parry enforces
        </span>
        <a
          href="https://github.com/kkd16/parry"
          target="_blank"
          rel="noreferrer"
        >
          github.com/kkd16/parry
        </a>
      </div>
    </>
  );
}

export default function AboutDialog({ open, onClose }: Props) {
  return (
    <Dialog open={open} onClose={onClose} className={dialogPanelCls}>
      <AboutContent />
    </Dialog>
  );
}
