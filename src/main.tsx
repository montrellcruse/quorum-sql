import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import "@uiw/react-textarea-code-editor/dist.css";

createRoot(document.getElementById("root")!).render(<App />);
