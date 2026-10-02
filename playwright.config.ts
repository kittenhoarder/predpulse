import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  fullyParallel: false,
  timeout: 30_000,
  use: {
    baseURL: process.env.AUDIT_URL ?? "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    reducedMotion: "reduce",
  },
  reporter: "list",
});
