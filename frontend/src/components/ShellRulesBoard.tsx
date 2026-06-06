import { highlight } from "../highlight";
import { ACTIONS, chipMatches, type ActionName, type ClusterChip } from "../utils/policyView";

const CLUSTER_SUB: Record<ActionName, string> = {
  allow: "runs silently, logged",
  confirm: "pauses until you approve",
  block: "refused and logged",
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
    <button className={`rule-chip rule-chip-${action}`} onClick={onClick}>
      {highlight(chip.label, query)}
      {chip.count > 1 && <span className="rule-chip-count">·{chip.count}</span>}
    </button>
  );
}

export default function ShellRulesBoard({ clusters, query, onOpenBinary }: Props) {
  return (
    <div className="rule-clusters">
      {ACTIONS.map((action) => {
        const all = clusters[action];
        const chips = all.filter((c) => chipMatches(c, query));
        return (
          <div className="rule-cluster" key={action}>
            <div className="rule-cluster-head">
              <span className={`rule-cluster-name rule-cluster-name-${action}`}>{action}</span>
              <span className="rule-cluster-count">{chips.length}</span>
              <span className="rule-cluster-sub">{CLUSTER_SUB[action]}</span>
            </div>
            {chips.length ? (
              <div className="rule-cloud">
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
              <div className="rule-cloud-empty muted">
                {all.length ? `no ${action} rules match` : `no ${action} rules`}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
