import { defineConfig } from "@playwright/test";

// UI contract tests: the mock preview (`bun run preview:ui`) in headless
// WebKit, asserting ARIA snapshots. See "UI contract tests" in BUILD.md.
//
// Version: the only @playwright/test release whose bundled WebKit build is
// 2365, the one in the local browser cache (stable 1.63 ships 2359, the 1.64
// betas 2370). Bump it together with `playwright install webkit`.
export default defineConfig({
  testDir: "tests/ui",
  fullyParallel: true,
  retries: 0,
  reporter: "list",
  // One file per snapshot, whatever the OS, so Linux CI and a Mac agree.
  snapshotPathTemplate:
    "{testDir}/{testFileDir}/__snapshots__/{testFileName}/{arg}{ext}",
  use: {
    baseURL: "http://localhost:1430",
    viewport: { width: 680, height: 570 },
    trace: "off",
  },
  projects: [
    { name: "light", use: { browserName: "webkit", colorScheme: "light" } },
    { name: "dark", use: { browserName: "webkit", colorScheme: "dark" } },
  ],
  webServer: {
    command: "bun run preview:ui -- --port 1430 --strictPort",
    url: "http://localhost:1430/",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
