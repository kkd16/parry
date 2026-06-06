import {
  nodeById,
  type DetailBlock,
  type DocNode,
  type NodeStatus,
  type SubComponent,
} from "../devdocs";
import Drawer from "./Drawer";

function StatusBadge({ status }: { status: NodeStatus }) {
  return <span className={`devdocs-badge devdocs-badge-${status}`}>{status}</span>;
}

function Component({ item }: { item: SubComponent }) {
  return (
    <li className="devdocs-subcomp">
      <span className="devdocs-subcomp-head">
        <span className="devdocs-subcomp-name">{item.name}</span>
        {item.status === "planned" && <StatusBadge status="planned" />}
      </span>
      {item.oneliner && <span className="devdocs-subcomp-oneliner">{item.oneliner}</span>}
    </li>
  );
}

function Block({ block }: { block: DetailBlock }) {
  switch (block.kind) {
    case "para":
      return <p className="devdocs-para">{block.text}</p>;
    case "packages":
      return (
        <section className="devdocs-drawer-section">
          <div className="drawer-field-label">{block.label ?? "key packages"}</div>
          <div className="devdocs-pkg-list">
            {block.paths.map((p) => (
              <span key={p} className="devdocs-pkg">
                {p}
              </span>
            ))}
          </div>
        </section>
      );
    case "components":
      return (
        <section className="devdocs-drawer-section">
          <div className="drawer-field-label">{block.label ?? "components"}</div>
          <ul className="devdocs-subcomp-list">
            {block.items.map((item) => (
              <Component key={item.name} item={item} />
            ))}
          </ul>
        </section>
      );
    case "note":
      return (
        <div className={`devdocs-note${block.tone === "planned" ? " devdocs-note-planned" : ""}`}>
          {block.text}
        </div>
      );
  }
}

interface Props {
  node: DocNode | null;
  onClose: () => void;
  onNavigate: (id: string) => void;
}

export default function DevDocsDrawer({ node, onClose, onNavigate }: Props) {
  const seeAlso = (node?.seeAlso ?? []).flatMap((id) => {
    const target = nodeById(id);
    return target ? [target] : [];
  });

  return (
    <Drawer
      open={!!node}
      onClose={onClose}
      eyebrow="component"
      title={node?.title ?? ""}
      bodyKey={node?.id}
    >
      {node && (
        <>
          <div className="devdocs-drawer-meta">
            <StatusBadge status={node.status} />
          </div>
          <p className="devdocs-lede">{node.oneliner}</p>

          {node.detail.map((block, i) => (
            <Block key={i} block={block} />
          ))}

          {seeAlso.length > 0 && (
            <section className="devdocs-drawer-section">
              <div className="drawer-field-label">see also</div>
              <div className="devdocs-seealso">
                {seeAlso.map((target) => (
                  <button key={target.id} className="btn" onClick={() => onNavigate(target.id)}>
                    {target.title}
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </Drawer>
  );
}
