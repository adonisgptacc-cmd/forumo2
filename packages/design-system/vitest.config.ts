import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: [
        "src/button.tsx",
        "src/card.tsx",
        "src/data-table.tsx",
        "src/filter-bar.tsx",
      ],
      thresholds: { lines: 80, branches: 80, functions: 80, statements: 80 },
      reporter: ["text", "lcov"],
    },
  },
});
