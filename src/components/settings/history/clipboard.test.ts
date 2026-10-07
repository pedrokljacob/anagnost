import { expect, test } from "bun:test";
import { copyToClipboard } from "./clipboard";

test("reports success when the clipboard accepts the text", async () => {
  const clipboard = { writeText: async () => {} };
  expect(await copyToClipboard("copied text", clipboard)).toBe(true);
});

test("reports failure instead of throwing when the clipboard is unavailable", async () => {
  const clipboard = {
    writeText: async () => {
      throw new Error("clipboard unavailable");
    },
  };
  expect(await copyToClipboard("copied text", clipboard)).toBe(false);
});
