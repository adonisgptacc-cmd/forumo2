import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: {
      exclude: ["**/*.test.ts", "**/*.d.ts"],
      include: [
        "src/lib/format-currency.ts",
        "src/lib/react-query/query-keys.ts",
        "src/lib/utils.ts",
      ],
      provider: "v8",
      reporter: ["text", "json-summary"],
      thresholds: {
        branches: 80,
        functions: 80,
        lines: 80,
        statements: 80,
      },
    },
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
