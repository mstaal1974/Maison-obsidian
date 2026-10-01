import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { interceptLinks, migrateLegacyHash } from "./lib/route";
import { initAnalytics } from "./lib/analytics";
import { initSiteLog } from "./lib/sitelog";

migrateLegacyHash();
interceptLinks();
initAnalytics();
initSiteLog();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
