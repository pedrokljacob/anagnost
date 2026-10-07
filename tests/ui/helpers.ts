import { expect, type Locator, type Page } from "@playwright/test";

// History shows relative and absolute times from the fixtures' `Date.now()`;
// freezing the clock keeps them stable across runs.
export const FIXED_TIME = new Date("2026-03-14T10:00:00Z").getTime();

export type Section =
  | "General"
  | "History"
  | "Models"
  | "Advanced"
  | "Post Process"
  | "Debug"
  | "About";

export const sidebar = (page: Page): Locator => page.locator("div.w-40");

// The scrollable settings area to the right of the sidebar.
export const content = (page: Page): Locator =>
  page.locator("div.overflow-y-auto").first();

export const openMain = async (page: Page, query = ""): Promise<void> => {
  await page.clock.setFixedTime(FIXED_TIME);
  await page.goto(`/${query}`);
  await expect(page.locator("#root")).not.toBeEmpty();
};

export const openSection = async (
  page: Page,
  section: Section,
): Promise<Locator> => {
  await sidebar(page).locator(`p[title="${section}"]`).click();
  const region = content(page);
  await expect(region).not.toBeEmpty();
  return region;
};

// The overlay plays its scenario from a 300 ms timeout and runs an elapsed
// timer while streaming, so the whole clock is faked and stepped by hand.
export const openOverlay = async (page: Page, query: string): Promise<void> => {
  await page.clock.install({ time: FIXED_TIME });
  await page.clock.pauseAt(FIXED_TIME);
  await page.goto(`/src/overlay/index.html?${query}`);
  await page.clock.runFor(1000);
  await expect(page.locator(".ov-stage")).toBeVisible();
};
