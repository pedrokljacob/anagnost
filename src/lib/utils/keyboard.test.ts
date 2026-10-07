import { describe, expect, test } from "bun:test";
import { formatKeyCombination, getKeyName } from "./keyboard";

const keyboardEvent = (value: { code?: string; key?: string }): KeyboardEvent =>
  value as KeyboardEvent;

const compoundKeys = [
  ["ScrollLock", "scrolllock", "Scroll Lock"],
  ["CapsLock", "capslock", "Caps Lock"],
  ["NumLock", "numlock", "Num Lock"],
  ["PageUp", "pageup", "Page Up"],
  ["PageDown", "pagedown", "Page Down"],
  ["PrintScreen", "printscreen", "Print Screen"],
] as const;

describe("compound keys", () => {
  for (const [code, stored, displayed] of compoundKeys) {
    test(`${code} is stored as ${stored} and shown as ${displayed}`, () => {
      expect(getKeyName(keyboardEvent({ code }))).toBe(stored);
      expect(formatKeyCombination(stored, "linux")).toBe(displayed);
    });
  }
});

test("falls back to the key name when the code is absent", () => {
  expect(getKeyName(keyboardEvent({ key: "CapsLock" }))).toBe("capslock");
});

test("media keys keep their full name", () => {
  expect(getKeyName(keyboardEvent({ code: "AudioVolumeUp" }))).toBe(
    "audiovolumeup",
  );
});

test("modifiers are named per platform", () => {
  expect(formatKeyCombination("option+space", "macos")).toBe("Option + Space");
  expect(formatKeyCombination("ctrl+shift+d", "linux")).toBe(
    "Ctrl + Shift + D",
  );
});
