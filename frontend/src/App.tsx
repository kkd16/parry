import { useState } from "react";
import EventsPage from "./EventsPage";
import PolicyPage from "./PolicyPage";

type Tab = "events" | "policy";

export default function App() {
  const [tab, setTab] = useState<Tab>("events");

  return (
    <div className="container">
      <nav className="navbar">
        <span className="navbar-title">Parry</span>
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
      {tab === "events" ? <EventsPage /> : <PolicyPage />}
    </div>
  );
}
