import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // React core - rarely changes
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          // Monaco editor - large, only needed for query editing
          "vendor-monaco": ["@monaco-editor/react"],
          // Radix UI components
          "vendor-radix": [
            "@radix-ui/react-alert-dialog",
            "@radix-ui/react-dialog",
            "@radix-ui/react-label",
            "@radix-ui/react-select",
            "@radix-ui/react-separator",
            "@radix-ui/react-slot",
            "@radix-ui/react-toast",
            "@radix-ui/react-tooltip",
          ],
          // Data/state management
          "vendor-data": [
            "@supabase/supabase-js",
            "@tanstack/react-query",
          ],
          // Utilities
          "vendor-utils": [
            "date-fns",
            "clsx",
            "tailwind-merge",
            "class-variance-authority",
          ],
        },
      },
    },
  },
});
