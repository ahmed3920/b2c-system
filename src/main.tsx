import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { bootstrapRosterCache } from "./data/rosterCache";

// Warm the global roster override cache so all sync mentor/TL lookups
// (CS tickets, tracking, action plans, etc.) reflect admin/TL overrides.
bootstrapRosterCache();

createRoot(document.getElementById("root")!).render(<App />);
