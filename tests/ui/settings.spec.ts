import { test, expect } from "@playwright/test";
import {
  content,
  openMain,
  openSection,
  sidebar,
  type Section,
} from "./helpers";

const SECTIONS: Section[] = [
  "General",
  "History",
  "Models",
  "Advanced",
  "Post Process",
  "Debug",
  "About",
];

test.describe("settings window", () => {
  for (const section of SECTIONS) {
    test(`${section} section`, async ({ page }) => {
      await openMain(page);
      const region = await openSection(page, section);
      await expect(region).toMatchAriaSnapshot({
        name: `section-${section.toLowerCase().replace(" ", "-")}.aria.yml`,
      });
    });
  }

  test("sidebar", async ({ page }) => {
    await openMain(page);
    await expect(sidebar(page)).toMatchAriaSnapshot({
      name: "sidebar.aria.yml",
    });
  });

  test("onboarding=1 shows the first-run permissions step", async ({
    page,
  }) => {
    await openMain(page, "?onboarding=1");
    await expect(page.locator("#root")).toMatchAriaSnapshot({
      name: "scenario-onboarding.aria.yml",
    });
  });

  test("perms=missing asks a returning user for permissions", async ({
    page,
  }) => {
    await openMain(page, "?perms=missing");
    await expect(page.locator("#root")).toMatchAriaSnapshot({
      name: "scenario-perms-missing.aria.yml",
    });
  });

  test("secure=1 shows the secure-input warning", async ({ page }) => {
    await openMain(page, "?secure=1");
    const region = content(page);
    await expect(
      region.getByRole("heading", { name: "General" }),
    ).toBeVisible();
    await expect(region).toMatchAriaSnapshot({
      name: "scenario-secure.aria.yml",
    });
  });

  test("models=none lists nothing downloaded", async ({ page }) => {
    await openMain(page, "?models=none");
    const region = await openSection(page, "Models");
    await expect(region).toMatchAriaSnapshot({
      name: "scenario-models-none.aria.yml",
    });
  });

  test("models=downloading shows a partial download", async ({ page }) => {
    await openMain(page, "?models=downloading");
    const region = await openSection(page, "Models");
    await expect(region).toMatchAriaSnapshot({
      name: "scenario-models-downloading.aria.yml",
    });
  });

  test("history=empty shows the empty state", async ({ page }) => {
    await openMain(page, "?history=empty");
    const region = await openSection(page, "History");
    await expect(region).toMatchAriaSnapshot({
      name: "scenario-history-empty.aria.yml",
    });
  });

  test("postprocess=0 hides the Post Process section", async ({ page }) => {
    await openMain(page, "?postprocess=0");
    await expect(sidebar(page)).toMatchAriaSnapshot({
      name: "scenario-postprocess-off-sidebar.aria.yml",
    });
    const region = await openSection(page, "Advanced");
    await expect(region).toMatchAriaSnapshot({
      name: "scenario-postprocess-off-advanced.aria.yml",
    });
  });
});
