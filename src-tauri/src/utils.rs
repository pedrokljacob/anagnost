use crate::managers::audio::AudioRecordingManager;
use crate::managers::transcription::TranscriptionManager;
use crate::shortcut;
use crate::TranscriptionCoordinator;
use log::info;
use std::sync::Arc;
use tauri::{AppHandle, Manager};

// Re-export all utility modules for easy access
// pub use crate::audio_feedback::*;
pub use crate::clipboard::*;
pub use crate::overlay::*;
pub use crate::tray::*;

/// Preserve diagnostic text in development builds, but redact it in releases.
/// Do not use for secrets such as API keys, which must always be redacted.
pub fn redact_text(text: &str) -> &str {
    if cfg!(debug_assertions) {
        text
    } else {
        "[REDACTED]"
    }
}

/// Centralized cancellation function that can be called from anywhere in the app.
/// Handles cancelling both recording and transcription operations and updates UI state.
pub fn cancel_current_operation(app: &AppHandle) {
    info!("Initiating operation cancellation...");

    // Unregister the cancel shortcut asynchronously
    shortcut::unregister_cancel_shortcut(app);

    // Cancel any ongoing recording
    let audio_manager = app.state::<Arc<AudioRecordingManager>>();
    let recording_was_active = audio_manager.is_recording();
    audio_manager.cancel_recording();

    // Abandon any live streaming transcription
    let tm = app.state::<Arc<TranscriptionManager>>();
    tm.cancel_stream();

    // Update tray icon and hide overlay
    set_tray_state(app, crate::tray::TrayIconState::Idle);
    hide_recording_overlay(app);

    // Unload model if immediate unload is enabled
    tm.maybe_unload_immediately("cancellation");

    // Notify coordinator so it can keep lifecycle state coherent.
    if let Some(coordinator) = app.try_state::<TranscriptionCoordinator>() {
        coordinator.notify_cancel(recording_was_active);
    }

    info!("Operation cancellation completed - returned to idle state");
}
