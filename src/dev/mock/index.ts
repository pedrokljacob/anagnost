// Browser preview of the UI without the Rust backend. Vite injects this module
// ahead of each page's entry script in `--mode mock` only (see
// `vite.config.ts`), so nothing here reaches the shipped app.
//
// Scenario parameters (URL query, all optional):
//   main window:  onboarding=1 (first-run permissions step)
//                 perms=missing (returning user without permissions)
//                 secure=1 (secure-input warning)  models=none|downloading
//                 history=empty  debug=0  postprocess=0
//   overlay page: state=recording|arming|streaming|streaming-empty|
//                 transcribing|processing|polishing  position=top|bottom
//   both:         theme=light|dark (default follows the browser)
//
// The model-picker onboarding step is reached through Debug > Onboarding
// preview: reaching it through the real flow needs granted permissions on a
// first run, which currently loops (see BACKLOG.md).
//
// `window.mockTauri.emit(event, payload)` fires a backend event, for example
// `mockTauri.emit("paste-error")` to show the paste-failure toast.

import { mockIPC, mockWindows } from "@tauri-apps/api/mocks";
import { emit } from "@tauri-apps/api/event";
import type { AppSettings, ModelInfo, Theme } from "@/bindings";
import {
  catalogModels,
  defaultSettings,
  historyEntries,
  LIVE_TEXT,
  microphones,
  outputDevices,
  secureInput,
} from "./fixtures";

const params = new URLSearchParams(window.location.search);
const param = (name: string) => params.get(name);
const isOverlay = window.location.pathname.includes("/overlay/");

const settings: AppSettings = {
  ...defaultSettings(),
  onboarding_completed: param("onboarding") === null,
  debug_mode: param("debug") !== "0",
  post_process_enabled: param("postprocess") !== "0",
};
const theme = param("theme");
if (theme === "light" || theme === "dark") settings.theme = theme as Theme;
const position = param("position");
if (position === "top" || position === "bottom") {
  settings.overlay_position = position;
}

const models: ModelInfo[] = catalogModels();
if (param("models") !== "none") {
  const [first, second, third] = models;
  Object.assign(first, { is_downloaded: true });
  Object.assign(second, { is_downloaded: true });
  if (param("models") === "downloading") {
    Object.assign(third, {
      is_downloading: true,
      partial_size: Math.round(third.size_mb * 0.4),
    });
  }
  settings.selected_model = first.id;
}

const permissionsGranted =
  param("perms") !== "missing" && param("onboarding") === null;
const history = param("history") === "empty" ? [] : historyEntries();

// Window label so `getCurrentWindow()` and typed events resolve.
mockWindows(isOverlay ? "recording_overlay" : "main");

window.__TAURI_OS_PLUGIN_INTERNALS__ = {
  platform: "macos",
  os_type: "macos",
  family: "unix",
  version: "15.0.0",
  arch: "aarch64",
  eol: "\n",
  exe_extension: "",
};

// `change_<key>_setting` commands carry one value; store it so a later
// `get_app_settings` reflects the change.
const applySettingChange = (cmd: string, args: Record<string, unknown>) => {
  const match = cmd.match(/^change_(.+?)(_setting)?$/);
  if (!match) return false;
  const values = Object.values(args ?? {});
  if (values.length !== 1) return true;
  const key = match[1] as keyof AppSettings;
  const target = (
    key in settings ? key : `${key}_enabled`
  ) as keyof AppSettings;
  (settings as Record<string, unknown>)[target] = values[0];
  return true;
};

mockIPC(
  (cmd, rawArgs) => {
    const args = (rawArgs ?? {}) as Record<string, unknown>;
    switch (cmd) {
      case "get_app_settings":
        return structuredClone(settings);
      case "get_default_settings":
        return defaultSettings();
      case "get_available_models":
        return structuredClone(models);
      case "get_current_model":
        return settings.selected_model;
      case "set_active_model":
        settings.selected_model = args.modelId as string;
        return null;
      case "get_available_microphones":
        return microphones;
      case "get_available_output_devices":
        return outputDevices;
      case "get_microphone_channels":
        return 1;
      case "get_available_accelerators":
        return { transcribe: ["auto", "cpu", "gpu"], ort: [], gpu_devices: [] };
      case "get_history_entries":
        return { entries: history, has_more: false };
      case "get_app_dir_path":
        return "/Users/you/Library/Application Support/com.pedrojacob.anagnost";
      case "get_log_dir_path":
        return "/Users/you/Library/Application Support/com.pedrojacob.anagnost/logs";
      case "is_laptop":
        return true;
      case "get_secure_input_status":
        return secureInput(param("secure") === "1");
      case "check_apple_intelligence_available":
        return true;
      case "fetch_post_process_models":
        return ["gpt-5-mini", "gpt-5", "gpt-4.1-mini"];
      case "get_windows_microphone_permission_status":
        return { supported: false, overall_access: "allowed" };
      case "plugin:app|version":
        return "0.9.8";
      case "plugin:app|name":
        return "Anagnost";
      case "plugin:os|locale":
        return "en-US";
      case "plugin:macos-permissions|check_accessibility_permission":
      case "plugin:macos-permissions|check_microphone_permission":
        return permissionsGranted;
      case "plugin:dialog|ask":
      case "plugin:dialog|confirm":
        return window.confirm(String(args.message ?? ""));
      case "plugin:fs|read_file":
        return new Uint8Array();
    }
    if (applySettingChange(cmd, args)) return null;
    if (!cmd.startsWith("get_") && !cmd.startsWith("plugin:")) return null;
    console.warn(`[mock] unhandled command: ${cmd}`, args);
    return null;
  },
  { shouldMockEvents: true },
);

window.mockTauri = { emit, settings };

// The overlay only renders after the backend tells it what to show, so play
// the requested state once its listeners are registered.
if (isOverlay) {
  document.documentElement.style.background =
    "linear-gradient(135deg, #8a9bb0, #c9b8a8)";
  const state = param("state") ?? "recording";
  const levels = () =>
    Array.from({ length: 16 }, (_, i) => 0.25 + 0.5 * Math.abs(Math.sin(i)));

  setTimeout(async () => {
    const streaming = state.startsWith("streaming") || state === "polishing";
    await emit("show-overlay", streaming ? "streaming" : state);
    if (state === "arming") return;
    if (state === "processing" || state === "transcribing") return;
    await emit("recording-ready");
    setInterval(() => {
      emit(
        "mic-level",
        levels().map((v) => v * (0.6 + 0.4 * Math.random())),
      );
    }, 80);
    if (streaming && state !== "streaming-empty") {
      await emit("stream-text-event", LIVE_TEXT);
    }
    if (state === "polishing") {
      await emit("stream-phase-event", { phase: "working", kind: "polishing" });
    }
  }, 300);
}

declare global {
  interface Window {
    mockTauri: { emit: typeof emit; settings: AppSettings };
  }
}
