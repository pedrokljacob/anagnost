// The store is exercised without a DOM: the generated bindings are replaced
// with a fake backend that records calls and can be told to fail.
import { beforeEach, expect, mock, test } from "bun:test";
import { defaultSettings } from "@/dev/mock/fixtures";
import type { AppSettings } from "@/bindings";

type Outcome =
  | { status: "ok"; data: null }
  | { status: "error"; error: string };
const calls: [string, unknown[]][] = [];
let outcome: Outcome = { status: "ok", data: null };
let backend: AppSettings = defaultSettings();

mock.module("@/bindings", () => ({
  commands: new Proxy(
    {},
    {
      get:
        (_target, name: string) =>
        async (...args: unknown[]) => {
          calls.push([name, args]);
          if (name === "getAppSettings") {
            return { status: "ok", data: structuredClone(backend) };
          }
          if (name === "getDefaultSettings") {
            return { status: "ok", data: defaultSettings() };
          }
          if (name === "changeBinding") {
            return outcome.status === "ok"
              ? { status: "ok", data: { success: true, error: null } }
              : outcome;
          }
          if (outcome.status === "error") throw new Error(outcome.error);
          return outcome;
        },
    },
  ),
}));

const { useSettingsStore } = await import("./settingsStore");
const transcribeBinding = () =>
  useSettingsStore.getState().settings?.bindings?.transcribe?.current_binding;

beforeEach(async () => {
  calls.length = 0;
  outcome = { status: "ok", data: null };
  backend = defaultSettings();
  await useSettingsStore.getState().refreshSettings();
  await useSettingsStore.getState().loadDefaultSettings();
});

test("loading fills the device fields the backend leaves empty", () => {
  const settings = useSettingsStore.getState().settings!;
  expect(settings.selected_microphone).toBe("Default");
  expect(settings.selected_output_device).toBe("Default");
  expect(settings.clamshell_microphone).toBe("Default");
});

test("a setting change is applied at once and sent to the backend", async () => {
  await useSettingsStore.getState().updateSetting("audio_feedback", true);
  expect(useSettingsStore.getState().settings!.audio_feedback).toBe(true);
  expect(calls.map(([name]) => name)).toContain("changeAudioFeedbackSetting");
  expect(useSettingsStore.getState().isUpdatingKey("audio_feedback")).toBe(
    false,
  );
});

test("a failed change rolls back to the previous value", async () => {
  outcome = { status: "error", error: "backend down" };
  await useSettingsStore.getState().updateSetting("audio_feedback", true);
  expect(useSettingsStore.getState().settings!.audio_feedback).toBe(false);
  expect(useSettingsStore.getState().isUpdatingKey("audio_feedback")).toBe(
    false,
  );
});

test("resetting a setting restores the backend default", async () => {
  await useSettingsStore.getState().updateSetting("hold_threshold_ms", 900);
  await useSettingsStore.getState().resetSetting("hold_threshold_ms");
  expect(useSettingsStore.getState().settings!.hold_threshold_ms).toBe(300);
});

test("a rejected shortcut goes back to the old binding", async () => {
  outcome = { status: "error", error: "already taken" };
  await expect(
    useSettingsStore.getState().updateBinding("transcribe", "cmd+j"),
  ).rejects.toThrow("already taken");
  expect(transcribeBinding()).toBe("option+space");
});

test("an accepted shortcut stays", async () => {
  await useSettingsStore.getState().updateBinding("transcribe", "cmd+j");
  expect(transcribeBinding()).toBe("cmd+j");
});
