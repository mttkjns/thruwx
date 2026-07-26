/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // Domain tests are pure functions; no DOM needed. Switch per-file with
    // `// @vitest-environment jsdom` if a component test ever needs it.
    environment: "node",
  },
});
