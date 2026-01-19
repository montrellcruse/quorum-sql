import { createRoot } from "react-dom/client";
import "@/lib/monacoSetup"; // Configure Monaco to use local bundle instead of CDN
import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);
