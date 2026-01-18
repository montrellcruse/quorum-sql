import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      // Proxy API requests to backend - solves CSRF cross-origin issues
      // Note: Only proxy specific auth endpoints, not /auth itself (that's a React route)
      "/api": {
        target: process.env.VITE_API_BASE_URL || "http://localhost:8787",
        changeOrigin: true,
      },
      "/auth/me": {
        target: process.env.VITE_API_BASE_URL || "http://localhost:8787",
        changeOrigin: true,
      },
      "/auth/login": {
        target: process.env.VITE_API_BASE_URL || "http://localhost:8787",
        changeOrigin: true,
      },
      "/auth/logout": {
        target: process.env.VITE_API_BASE_URL || "http://localhost:8787",
        changeOrigin: true,
      },
      "/auth/register": {
        target: process.env.VITE_API_BASE_URL || "http://localhost:8787",
        changeOrigin: true,
      },
      "/health": {
        target: process.env.VITE_API_BASE_URL || "http://localhost:8787",
        changeOrigin: true,
      },
      "/teams": {
        target: process.env.VITE_API_BASE_URL || "http://localhost:8787",
        changeOrigin: true,
      },
      "/invites": {
        target: process.env.VITE_API_BASE_URL || "http://localhost:8787",
        changeOrigin: true,
      },
      "/folders": {
        target: process.env.VITE_API_BASE_URL || "http://localhost:8787",
        changeOrigin: true,
      },
      "/queries": {
        target: process.env.VITE_API_BASE_URL || "http://localhost:8787",
        changeOrigin: true,
      },
      "/approvals": {
        target: process.env.VITE_API_BASE_URL || "http://localhost:8787",
        changeOrigin: true,
      },
    },
  },
  plugins: [react()],
  // Optimize monaco-editor for bundling
  optimizeDeps: {
    include: ["monaco-editor"],
  },
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
          "vendor-monaco": ["@monaco-editor/react", "monaco-editor"],
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
