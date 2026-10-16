import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "/reveal-run/",
  plugins: [react(), tailwindcss()],
  resolve: { alias: { "@": resolve(__dirname, "src") } },
  build: {
    outDir: "mania-dist",
    emptyOutDir: true,
    rollupOptions: {
      input: resolve(__dirname, "host/index.html"),
    },
  },
});
