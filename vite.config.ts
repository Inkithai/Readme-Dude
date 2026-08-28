import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
  // GitHub Pages serves the build under /<repo>/ — keep asset URLs relative-safe.
  base: process.env.GH_PAGES ? "/Readme-Dude/" : "/",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: false,
    // Arena/preview proxies reach the dev server on a *.e2b.app host.
    allowedHosts: [".e2b.app"],
  },
  preview: { host: "0.0.0.0", port: 4173, allowedHosts: [".e2b.app"] },
  build: {
    target: "es2023",
    // Chunk splitting comes for free from the dynamic imports in App.tsx
    // (React.lazy on the preview) — Rolldown also accepts output.advancedChunks
    // if a future dependency needs to be forced into its own chunk.
    chunkSizeWarningLimit: 640,
  },
});
