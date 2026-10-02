import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: [["list"]],
  timeout: 30_000,
  // one retry in CI only: shared runners are slower and noisier than a laptop; a real failure still fails twice
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: "http://localhost:5190",
    trace: "retain-on-failure",
    viewport: { width: 1280, height: 900 },
  },
  // run one engine with --project=chromium | firefox | webkit (Safari's engine)
  projects: [
    // clipboard permissions only exist in Chromium; clipboard reads are skipped elsewhere
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 }, permissions: ["clipboard-read", "clipboard-write"] },
    },
    { name: "firefox", use: { ...devices["Desktop Firefox"], viewport: { width: 1280, height: 900 } } },
    { name: "webkit", use: { ...devices["Desktop Safari"], viewport: { width: 1280, height: 900 } } },
  ],
  webServer: {
    command: "pnpm dev",
    url: "http://localhost:5190",
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
