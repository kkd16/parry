interface Props {
  eyebrow?: string;
  title: string;
  sub?: string;
}

export default function PageHeader({ eyebrow, title, sub }: Props) {
  return (
    <header className="page-header">
      {eyebrow && <div className="page-header-eyebrow">{eyebrow}</div>}
      <h1 className="page-header-title">{title}</h1>
      {sub && <div className="page-header-sub">{sub}</div>}
      <div className="ornament-line" aria-hidden>
        <span className="ornament-dot" />
      </div>
    </header>
  );
}
