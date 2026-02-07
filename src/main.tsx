import React from "react";
import { createRoot } from "react-dom/client";
import "@/lib/monacoSetup"; // Configure Monaco to use local bundle instead of CDN
import { initTelemetry } from "@/lib/telemetry";
import App from "./App.tsx";
import "./index.css";

initTelemetry();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
