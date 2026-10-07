import { test, expect } from "@playwright/test";
import { openOverlay } from "./helpers";

const STATES = [
  "recording",
  "arming",
  "streaming",
  "streaming-empty",
  "transcribing",
  "processing",
  "polishing",
] as const;
const POSITIONS = ["top", "bottom"] as const;

const isStreaming = (state: string) =>
  state.startsWith("streaming") || state === "polishing";

test.describe("recording overlay", () => {
  for (const position of POSITIONS) {
    for (const state of STATES) {
      test(`state=${state} position=${position}`, async ({ page }) => {
        const streaming = isStreaming(state);
        await page.setViewportSize(
          streaming ? { width: 400, height: 120 } : { width: 256, height: 50 },
        );
        await openOverlay(page, `state=${state}&position=${position}`);
        await expect(page.locator(".ov-stage")).toHaveClass(
          new RegExp(`\\b${position}\\b`),
        );
        await expect(page.locator("#root")).toMatchAriaSnapshot({
          name: `state-${state}.aria.yml`,
        });
      });
    }
  }

  test("streaming timer advances with the clock", async ({ page }) => {
    await page.setViewportSize({ width: 400, height: 120 });
    await openOverlay(page, "state=streaming");
    await expect(page.locator(".stimer")).toHaveText("0:00");
    await page.clock.runFor(2000);
    await expect(page.locator(".stimer")).toHaveText("0:02");
  });
});
