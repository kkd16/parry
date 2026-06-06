import { useEffect, useState, type ReactNode } from "react";
import "./CopyButton.css";

interface Props {
  text: string;
  className?: string;
  label?: ReactNode;
  copiedLabel?: ReactNode;
  onCopied?: () => void;
}

export default function CopyButton({
  text,
  className = "copy-btn",
  label = "copy",
  copiedLabel = "copied",
  onCopied,
}: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1200);
    return () => clearTimeout(t);
  }, [copied]);

  return (
    <button
      className={className}
      onClick={() => {
        void navigator.clipboard.writeText(text);
        setCopied(true);
        onCopied?.();
      }}
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
