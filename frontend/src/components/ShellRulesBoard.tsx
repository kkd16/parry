import clsx from "clsx";
import { highlight } from "../highlight";
import {
  ACTIONS,
  chipMatches,
  type ActionName,
  type ClusterChip,
} from "../utils/policyView";

const CLUSTER_SUB: Record<ActionName, string> = {
  allow: "runs silently, logged",
  confirm: "pauses until you approve",
  block: "refused and logged",
};

const CLUSTER_NAME_CLS: Record<ActionName, string> = {
  allow: "text-allow",
  confirm: "text-confirm",
  block: "text-block",
};

const CHIP_CLS: Record<ActionName, string> = {
  allow: "border-allow/18 bg-allow/12 text-allow",
  confirm: "border-confirm/20 bg-confirm/14 text-confirm",
  block: "border-block/20 bg-block/12 text-block",
};

interface Props {
  clusters: Record<ActionName, ClusterChip[]>;
  query: string;
  onOpenBinary: (binary: string) => void;
}

function Chip({
  chip,
  action,
  query,
  onClick,
}: {
  chip: ClusterChip;
  action: ActionName;
  query: string;
  onClick: () => void;
}) {
  return (
    <button
      className={clsx(
        "cursor-pointer rounded border px-2.75 py-1.25 font-mono text-meta transition-[border-color,transform,box-shadow] duration-140 hover:-translate-y-px hover:border-brass hover:shadow-[0_3px_10px_rgba(0,0,0,0.35)] focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-brass",
        CHIP_CLS[action],
      )}
      onClick={onClick}
    >
      {highlight(chip.label, query)}
      {chip.count > 1 && (
        <span className="ml-1.5 text-tiny opacity-60">·{chip.count}</span>
      )}
    </button>
  );
}

export default function ShellRulesBoard({
  clusters,
  query,
  onOpenBinary,
}: Props) {
  return (
    <div className="mt-1.5 flex flex-col gap-6">
      {ACTIONS.map((action) => {
        const all = clusters[action];
        const chips = all.filter((c) => chipMatches(c, query));
        return (
          <div key={action}>
            <div className="flex items-baseline gap-2.5">
              <span
                className={clsx(
                  "inline-flex items-center gap-1.75 font-mono text-tiny font-semibold tracking-[0.18em] uppercase before:h-1.5 before:w-1.5 before:rotate-45 before:bg-current before:content-['']",
                  CLUSTER_NAME_CLS[action],
                )}
              >
                {action}
              </span>
              <span className="font-mono text-tiny text-ink-mute">
                {chips.length}
              </span>
              <span className="font-display text-body text-ink-mute italic">
                {CLUSTER_SUB[action]}
              </span>
            </div>
            {chips.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {chips.map((chip) => (
                  <Chip
                    key={chip.binary}
                    chip={chip}
                    action={action}
                    query={query}
                    onClick={() => onOpenBinary(chip.binary)}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-2.5 text-body text-ink-mute italic">
                {all.length ? `no ${action} rules match` : `no ${action} rules`}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
