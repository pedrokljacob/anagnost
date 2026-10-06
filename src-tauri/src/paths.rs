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

/// Create the app data folder and keep it private to the user (mode 0700):
/// it holds the settings file with the post-processing API keys, the
/// transcription history and the logs. Only the folder is changed, so files
/// other users could already read keep their mode; on a single-user Mac the
/// folder is what matters.
pub fn restrict_app_data_dir(app: &tauri::AppHandle) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| format!("{}: {e}", dir.display()))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&dir, std::fs::Permissions::from_mode(0o700))
            .map_err(|e| format!("{}: {e}", dir.display()))?;
    }
    Ok(())
}
