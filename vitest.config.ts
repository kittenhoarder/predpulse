import { defineConfig } from "vitest/config";
import { resolve } from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "lib/guide.ts",
        "lib/nav.ts",
        "lib/bootstrap.ts",
        "lib/sheet-history.ts",
      ],
      thresholds: { lines: 85, statements: 85, functions: 85, branches: 85 },
    },
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
});
