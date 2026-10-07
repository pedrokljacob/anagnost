import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "path";

const host = process.env.TAURI_DEV_HOST;

// `--mode mock` (`bun run preview:ui`): run the UI in a plain browser with a
// fake backend by loading `src/dev/mock` ahead of each page's entry script.
const mockBackend = (): Plugin => ({
  name: "mock-backend",
  transformIndexHtml: (html) =>
    html.replace(
      '<script type="module"',
      '<script type="module" src="/src/dev/mock/index.ts"></script>\n    <script type="module"',
    ),
});

// https://vitejs.dev/config/
export default defineConfig(async ({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    ...(mode === "mock" ? [mockBackend()] : []),
  ],

  // Path aliases
  resolve: {
    // bun.lock nests older @tauri-apps/api copies under the plugins; bundle
    // the root one only.
    dedupe: ["@tauri-apps/api"],
    alias: {
      "@": resolve(__dirname, "./src"),
      "@/bindings": resolve(__dirname, "./src/bindings.ts"),
    },
  },

  // Multiple entry points for main app and overlay
  build: {
    // WKWebView on macOS 13, the oldest supported system, is Safari 16.
    target: "safari16",
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        overlay: resolve(__dirname, "src/overlay/index.html"),
      },
    },
  },

  esbuild: {
    // One copy of each license header at the end of a chunk instead of one
    // per module.
    legalComments: "eof",
  },

  // Vite options tailored for Tauri development and only applied in `tauri dev` or `tauri build`
  //
  // 1. prevent vite from obscuring rust errors
  clearScreen: false,
  // 2. tauri expects a fixed port, fail if that port is not available
  // The mock preview takes the next free port from 1430 so several worktrees
  // can run it side by side.
  server: {
    port: mode === "mock" ? 1430 : 1420,
    strictPort: mode !== "mock",
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. tell vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
