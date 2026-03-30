import { useState } from "react";
import EventsPage from "./EventsPage";
import PolicyOverviewBar from "./PolicyOverviewBar";
import PolicyPage from "./PolicyPage";
import { usePolicyOverview } from "./usePolicyOverview";

type Tab = "events" | "policy";

export default function App() {
  const [tab, setTab] = useState<Tab>("events");
  const overview = usePolicyOverview();

  return (
    <div className="container">
      <nav className="navbar">
        <span className="navbar-title">Parry</span>
        <PolicyOverviewBar {...overview} />
        <div className="navbar-tabs">
          <button
            className={`navbar-tab${tab === "events" ? " active" : ""}`}
            onClick={() => setTab("events")}
          >
            Events
          </button>
          <button
            className={`navbar-tab${tab === "policy" ? " active" : ""}`}
            onClick={() => setTab("policy")}
          >
            Policy
          </button>
        </div>
      </nav>
      {tab === "events" ? <EventsPage /> : <PolicyPage {...overview} />}
    </div>
  );
}
