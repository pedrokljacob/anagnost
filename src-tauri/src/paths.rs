//! Where the app keeps its files. Everything lives in the app data folder
//! (`~/Library/Application Support/<identifier>/` on macOS), logs included.

use std::path::PathBuf;
use tauri::Manager;

/// Log folder, inside the app data folder so all app files live in one place.
pub fn app_log_dir(app: &tauri::AppHandle) -> Result<PathBuf, tauri::Error> {
    Ok(app.path().app_data_dir()?.join("logs"))
}

/// Same folder as [`app_log_dir`], resolved before Tauri starts because the log
/// plugin needs it at build time. Mirrors how Tauri resolves `app_data_dir`.
pub fn log_dir(identifier: &str) -> Option<PathBuf> {
    dirs::data_dir().map(|dir| dir.join(identifier).join("logs"))
}
