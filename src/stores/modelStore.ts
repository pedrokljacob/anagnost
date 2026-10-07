import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { listen } from "@tauri-apps/api/event";
import { commands, type ModelInfo } from "@/bindings";
import { toast } from "sonner";

interface DownloadProgress {
  model_id: string;
  downloaded: number;
  total: number;
  percentage: number;
}

interface DownloadStats {
  startTime: number;
  lastUpdate: number;
  totalDownloaded: number;
  speed: number; // MB/s
}

interface ModelsStore {
  models: ModelInfo[];
  currentModel: string;
  downloadingModels: Record<string, true>;
  verifyingModels: Record<string, true>;
  downloadProgress: Record<string, DownloadProgress>;
  downloadStats: Record<string, DownloadStats>;
  loading: boolean;
  error: string | null;
  initialized: boolean;
  isRescanning: boolean;

  // Actions
  initialize: () => Promise<void>;
  loadModels: () => Promise<void>;
  loadCurrentModel: () => Promise<void>;
  rescanLocalModels: () => Promise<void>;
  selectModel: (modelId: string) => Promise<boolean>;
  downloadModel: (modelId: string) => Promise<boolean>;
  cancelDownload: (modelId: string) => Promise<boolean>;
  deleteModel: (modelId: string) => Promise<boolean>;
  getModelInfo: (modelId: string) => ModelInfo | undefined;
  isModelDownloading: (modelId: string) => boolean;
  isModelVerifying: (modelId: string) => boolean;
  getDownloadProgress: (modelId: string) => DownloadProgress | undefined;

  // Internal setters
  setModels: (models: ModelInfo[]) => void;
  setCurrentModel: (modelId: string) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
}

// Copy of `record` without `key`. State is replaced, never mutated.
const without = <T>(
  record: Record<string, T>,
  key: string,
): Record<string, T> => {
  const { [key]: _dropped, ...rest } = record;
  return rest;
};

// Download bookkeeping for one model, cleared when a download ends.
// Verification state is kept: it is cleared by its own events.
const withoutDownload = (state: ModelsStore, modelId: string) => ({
  downloadingModels: without(state.downloadingModels, modelId),
  downloadProgress: without(state.downloadProgress, modelId),
  downloadStats: without(state.downloadStats, modelId),
});

export const useModelStore = create<ModelsStore>()(
  subscribeWithSelector((set, get) => ({
    models: [],
    currentModel: "",
    downloadingModels: {},
    verifyingModels: {},
    downloadProgress: {},
    downloadStats: {},
    loading: true,
    error: null,
    initialized: false,
    isRescanning: false,

    // Internal setters
    setModels: (models) => set({ models }),
    setCurrentModel: (currentModel) => set({ currentModel }),
    setError: (error) => set({ error }),
    setLoading: (loading) => set({ loading }),

    loadModels: async () => {
      try {
        const result = await commands.getAvailableModels();
        if (result.status === "ok") {
          // Sync downloading state from backend: keep every model the
          // backend reports as downloading, plus the ones the frontend still
          // has progress for; drop the rest (completed/cancelled).
          set((state) => {
            const backendDownloading = new Set(
              result.data.filter((m) => m.is_downloading).map((m) => m.id),
            );
            const downloadingModels: Record<string, true> = {};
            Object.keys(state.downloadingModels).forEach((id) => {
              if (backendDownloading.has(id) || state.downloadProgress[id]) {
                downloadingModels[id] = true;
              }
            });
            backendDownloading.forEach((id) => {
              downloadingModels[id] = true;
            });
            return { models: result.data, error: null, downloadingModels };
          });
        } else {
          set({ error: `Failed to load models: ${result.error}` });
        }
      } catch (err) {
        set({ error: `Failed to load models: ${err}` });
      } finally {
        set({ loading: false });
      }
    },

    loadCurrentModel: async () => {
      try {
        const result = await commands.getCurrentModel();
        if (result.status === "ok") {
          set({ currentModel: result.data });
        }
      } catch (err) {
        console.error("Failed to load current model:", err);
      }
    },

    rescanLocalModels: async () => {
      set({ isRescanning: true });
      try {
        const result = await commands.rescanLocalModels();
        if (result.status !== "ok") {
          set({ error: `Failed to rescan models: ${result.error}` });
        }
        // On success the backend emits `models-updated`, which reloads the list
        // via the listener registered in initialize().
      } catch (err) {
        set({ error: `Failed to rescan models: ${err}` });
      } finally {
        set({ isRescanning: false });
      }
    },

    selectModel: async (modelId: string) => {
      try {
        set({ error: null });
        const result = await commands.setActiveModel(modelId);
        if (result.status === "ok") {
          set({ currentModel: modelId });
          return true;
        } else {
          set({ error: `Failed to switch to model: ${result.error}` });
          return false;
        }
      } catch (err) {
        set({ error: `Failed to switch to model: ${err}` });
        return false;
      }
    },

    downloadModel: async (modelId: string) => {
      try {
        set((state) => ({
          error: null,
          downloadingModels: { ...state.downloadingModels, [modelId]: true },
          downloadProgress: {
            ...state.downloadProgress,
            [modelId]: {
              model_id: modelId,
              downloaded: 0,
              total: 0,
              percentage: 0,
            },
          },
        }));
        const result = await commands.downloadModel(modelId);
        if (result.status !== "ok") {
          // Fallback cleanup in case the model-download-failed event was not received
          // (e.g. listener not yet registered). The event handler is a no-op if it
          // arrives after this cleanup since dropping missing keys is safe.
          set((state) => withoutDownload(state, modelId));
        }
        return result.status === "ok";
      } catch {
        // model-download-failed event won't fire for JS exceptions (e.g. IPC error),
        // so clean up state here to avoid a stuck progress spinner.
        set((state) => withoutDownload(state, modelId));
        return false;
      }
    },

    cancelDownload: async (modelId: string) => {
      try {
        set({ error: null });
        const result = await commands.cancelDownload(modelId);
        if (result.status === "ok") {
          set((state) => withoutDownload(state, modelId));

          // Reload models to sync with backend state
          await get().loadModels();
          return true;
        } else {
          set({ error: `Failed to cancel download: ${result.error}` });
          return false;
        }
      } catch (err) {
        set({ error: `Failed to cancel download: ${err}` });
        return false;
      }
    },

    deleteModel: async (modelId: string) => {
      try {
        set({ error: null });
        const result = await commands.deleteModel(modelId);
        if (result.status === "ok") {
          await get().loadModels();
          await get().loadCurrentModel();
          return true;
        } else {
          set({ error: `Failed to delete model: ${result.error}` });
          return false;
        }
      } catch (err) {
        set({ error: `Failed to delete model: ${err}` });
        return false;
      }
    },

    getModelInfo: (modelId: string) => {
      return get().models.find((model) => model.id === modelId);
    },

    isModelDownloading: (modelId: string) => {
      return modelId in get().downloadingModels;
    },

    isModelVerifying: (modelId: string) => {
      return modelId in get().verifyingModels;
    },

    getDownloadProgress: (modelId: string) => {
      return get().downloadProgress[modelId];
    },

    initialize: async () => {
      if (get().initialized) return;

      const { loadModels, loadCurrentModel } = get();

      // Load initial data
      await Promise.all([loadModels(), loadCurrentModel()]);

      // Set up event listeners
      listen<DownloadProgress>("model-download-progress", (event) => {
        const progress = event.payload;
        const now = Date.now();
        set((state) => {
          // Download stats for the speed estimate
          const current = state.downloadStats[progress.model_id];
          let stats = current;
          if (!current) {
            stats = {
              startTime: now,
              lastUpdate: now,
              totalDownloaded: progress.downloaded,
              speed: 0,
            };
          } else {
            const timeDiff = (now - current.lastUpdate) / 1000;
            const bytesDiff = progress.downloaded - current.totalDownloaded;

            if (timeDiff > 0.5) {
              const currentSpeed = bytesDiff / (1024 * 1024) / timeDiff;
              const validCurrentSpeed = Math.max(0, currentSpeed);
              const smoothedSpeed =
                current.speed > 0
                  ? current.speed * 0.8 + validCurrentSpeed * 0.2
                  : validCurrentSpeed;

              stats = {
                startTime: current.startTime,
                lastUpdate: now,
                totalDownloaded: progress.downloaded,
                speed: Math.max(0, smoothedSpeed),
              };
            }
          }
          return {
            downloadProgress: {
              ...state.downloadProgress,
              [progress.model_id]: progress,
            },
            downloadStats: {
              ...state.downloadStats,
              [progress.model_id]: stats,
            },
          };
        });
      });

      listen<string>("model-download-complete", (event) => {
        const modelId = event.payload;
        set((state) => ({
          ...withoutDownload(state, modelId),
          verifyingModels: without(state.verifyingModels, modelId),
        }));
        get().loadModels();
      });

      listen<{ model_id: string; error: string }>(
        "model-download-failed",
        (event) => {
          const { model_id: modelId, error } = event.payload;
          set((state) => ({
            ...withoutDownload(state, modelId),
            verifyingModels: without(state.verifyingModels, modelId),
            error,
          }));
          toast.error(error);
        },
      );

      listen<string>("model-verification-started", (event) => {
        const modelId = event.payload;
        set((state) => ({
          verifyingModels: { ...state.verifyingModels, [modelId]: true },
        }));
      });

      listen<string>("model-verification-completed", (event) => {
        const modelId = event.payload;
        set((state) => ({
          verifyingModels: without(state.verifyingModels, modelId),
        }));
      });

      listen<string>("model-download-cancelled", (event) => {
        const modelId = event.payload;
        set((state) => ({
          ...withoutDownload(state, modelId),
          verifyingModels: without(state.verifyingModels, modelId),
        }));
      });

      listen<string>("model-deleted", () => {
        get().loadModels();
        get().loadCurrentModel();
      });

      listen("model-state-changed", () => {
        get().loadModels();
        get().loadCurrentModel();
      });

      listen("models-updated", () => {
        get().loadModels();
        get().loadCurrentModel();
      });

      set({ initialized: true });
    },
  })),
);
