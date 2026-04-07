interface Props {
  section: string;
  eventCount: number;
  live: boolean;
  mode?: string;
}

const SECTION_LABELS: Record<string, string> = {
  events: "logbook",
  solar: "orrery",
  policy: "charter",
};

export default function StatusStrip({ section, eventCount, live, mode }: Props) {
  return (
    <footer className="status-strip">
      <span className="status-strip-section">{SECTION_LABELS[section] ?? section}</span>
      <div className="status-strip-center">
        <span className={`status-strip-pulse${live ? " live" : ""}`} />
        <span>{eventCount.toLocaleString()} events recorded</span>
      </div>
      <div className="status-strip-right">
        {mode && <span>mode: {mode}</span>}
        <span>
          <span className="kbd">⌘</span>
          <span className="kbd">space</span> palette
        </span>
      </div>
    </footer>
  );
}
