import clsx from "clsx";
import {
  nodeById,
  type DetailBlock,
  type DocNode,
  type NodeStatus,
  type SubComponent,
} from "../devdocs";
import Drawer, { drawerLabelCls, drawerSectionCls } from "./Drawer";
import { Btn } from "./ui";

const BADGE_CLS: Record<NodeStatus, string> = {
  shipped: "border-allow/35 bg-allow/12 text-allow",
  planned: "border-dashed border-observe/35 bg-observe/14 text-observe",
};

const labelCls = clsx("mb-2.5", drawerLabelCls);

function StatusBadge({ status }: { status: NodeStatus }) {
  return (
    <span
      className={clsx(
        "inline-block rounded-[3px] border px-[7px] py-0.5 font-mono text-[0.6rem] tracking-[0.1em] uppercase",
        BADGE_CLS[status],
      )}
    >
      {status}
    </span>
  );
}

function Component({ item }: { item: SubComponent }) {
  return (
    <li className="flex flex-col gap-[3px]">
      <span className="flex items-center gap-2">
        <span className="font-mono text-[0.74rem] text-ink">{item.name}</span>
        {item.status === "planned" && <StatusBadge status="planned" />}
      </span>
      {item.oneliner && (
        <span className="text-[0.74rem] leading-[1.45] text-ink-mute">
          {item.oneliner}
        </span>
      )}
    </li>
  );
}

function Block({ block }: { block: DetailBlock }) {
  switch (block.kind) {
    case "para":
      return (
        <p className="mt-3.5 text-[0.8rem] leading-[1.65] text-ink-dim">
          {block.text}
        </p>
      );
    case "packages":
      return (
        <section className={drawerSectionCls}>
          <div className={labelCls}>{block.label ?? "key packages"}</div>
          <div className="flex flex-wrap gap-1.5">
            {block.paths.map((p) => (
              <span
                key={p}
                className="rounded-[3px] border border-rule bg-bg px-2 py-[3px] font-mono text-[0.7rem] text-brass"
              >
                {p}
              </span>
            ))}
          </div>
        </section>
      );
    case "components":
      return (
        <section className={drawerSectionCls}>
          <div className={labelCls}>{block.label ?? "components"}</div>
          <ul className="flex flex-col gap-2.5">
            {block.items.map((item) => (
              <Component key={item.name} item={item} />
            ))}
          </ul>
        </section>
      );
    case "note":
      return (
        <div
          className={clsx(
            "mt-3.5 rounded border px-3 py-[9px] text-[0.76rem] leading-[1.5]",
            block.tone === "planned"
              ? "border-dashed border-brass-dim bg-observe/14 text-observe"
              : "border-rule bg-bg text-ink-dim",
          )}
        >
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
          <div className="flex items-center gap-2">
            <StatusBadge status={node.status} />
          </div>
          <p className="mt-3 text-[0.88rem] leading-[1.5] text-ink">
            {node.oneliner}
          </p>

          {node.detail.map((block, i) => (
            <Block key={i} block={block} />
          ))}

          {seeAlso.length > 0 && (
            <section className={drawerSectionCls}>
              <div className={labelCls}>see also</div>
              <div className="flex flex-wrap gap-1.5">
                {seeAlso.map((target) => (
                  <Btn key={target.id} onClick={() => onNavigate(target.id)}>
                    {target.title}
                  </Btn>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </Drawer>
  );
}
