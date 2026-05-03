import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { bootstrapAuth } from "./integrations/supabase/authRecovery";

bootstrapAuth();

createRoot(document.getElementById("root")!).render(<App />);
