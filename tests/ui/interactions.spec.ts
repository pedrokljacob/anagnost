import { test, expect } from "@playwright/test";
import { content, openMain, openSection } from "./helpers";

// A setting's checkbox, found from its heading inside the General section.
const settingCheckbox = (region: ReturnType<typeof content>, title: string) =>
  region
    .getByRole("heading", { name: title, exact: true })
    .locator("xpath=ancestor::div[.//input[@type='checkbox']][1]")
    .getByRole("checkbox");

test.describe("mock interactions", () => {
  test("a toggled setting survives a reload", async ({ page }) => {
    await openMain(page);
    const region = await openSection(page, "General");
    const checkbox = settingCheckbox(region, "Mute While Recording");
    await expect(checkbox).not.toBeChecked();
    // The input is visually hidden; its label is the switch.
    await checkbox.locator("..").click();
    await expect(checkbox).toBeChecked();

    await page.reload();
    const after = await openSection(page, "General");
    await expect(settingCheckbox(after, "Mute While Recording")).toBeChecked();
  });

  test("history entries can be starred and deleted", async ({ page }) => {
    await openMain(page);
    const region = await openSection(page, "History");
    const deleteButtons = region.getByRole("button", { name: "Delete entry" });
    await expect(deleteButtons).toHaveCount(4);

    await region
      .getByRole("button", { name: "Save transcription" })
      .first()
      .click();
    await expect(
      region.getByRole("button", { name: "Remove from saved" }),
    ).toHaveCount(2);

    await deleteButtons.first().click();
    await expect(deleteButtons).toHaveCount(3);
    await expect(region).not.toContainText("quarterly numbers");
  });

  test("a model download can be started and cancelled", async ({ page }) => {
    await openMain(page);
    const region = await openSection(page, "Models");
    const card = region.getByRole("button", { name: /^Canary 180M Flash/ });
    await card.click();
    const cancel = region.getByRole("button", { name: "Cancel download" });
    await expect(cancel).toBeVisible();
    await cancel.click();
    await expect(cancel).toHaveCount(0);
    await expect(
      region.getByRole("heading", { name: "Canary 180M Flash" }),
    ).toBeVisible();
  });

  test("deleting a model goes through a confirm dialog", async ({ page }) => {
    await openMain(page);
    const region = await openSection(page, "Models");
    const card = region.getByRole("button", {
      name: /^Nemotron Streaming 3.5/,
    });
    const messages: string[] = [];

    page.once("dialog", (dialog) => {
      messages.push(dialog.message());
      void dialog.dismiss();
    });
    await card.getByRole("button", { name: "Delete" }).click();
    await expect.poll(() => messages.length).toBe(1);
    expect(messages[0]).toContain("Nemotron Streaming 3.5");
    await expect(card.getByRole("button", { name: "Delete" })).toBeVisible();

    page.once("dialog", (dialog) => void dialog.accept());
    await card.getByRole("button", { name: "Delete" }).click();
    await expect(card.getByRole("button", { name: "Delete" })).toHaveCount(0);
    await expect(
      region.getByRole("heading", { name: "Nemotron Streaming 3.5" }),
    ).toBeVisible();
  });
});
