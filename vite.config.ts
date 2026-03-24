import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import { visualizer } from "rollup-plugin-visualizer";
import path from "path";

// https://vitejs.dev/config/
const analyze = process.env.ANALYZE === "true";
const plugins = [react()];
const manualChunkGroups = [
  // React core - rarely changes
  ["vendor-react", /node_modules\/(?:react|react-dom|react-router-dom)\//],
  // Monaco editor - large, only needed for query editing
  ["vendor-monaco", /node_modules\/(?:@monaco-editor\/react|monaco-editor)\//],
  // Radix UI components
  [
    "vendor-radix",
    /node_modules\/(?:@radix-ui\/react-alert-dialog|@radix-ui\/react-dialog|@radix-ui\/react-label|@radix-ui\/react-select|@radix-ui\/react-separator|@radix-ui\/react-slot|@radix-ui\/react-toast|@radix-ui\/react-tooltip)\//,
  ],
  // Data/state management
  [
    "vendor-data",
    /node_modules\/(?:@supabase\/supabase-js|@tanstack\/react-query)\//,
  ],
  // Utilities
  [
    "vendor-utils",
    /node_modules\/(?:date-fns|clsx|tailwind-merge|class-variance-authority)\//,
  ],
] as const;
if (analyze) {
  plugins.push(
    visualizer({
      filename: "dist/stats.html",
      gzipSize: true,
      brotliSize: true,
      open: false,
    }),
  );
}

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
  plugins,
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
        manualChunks(id) {
          for (const [name, pattern] of manualChunkGroups) {
            if (pattern.test(id)) {
              return name;
            }
          }
        },
      },
    },
  },
});
