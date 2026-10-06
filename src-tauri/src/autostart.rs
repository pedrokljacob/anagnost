//! Launch-at-login (autostart) handling.
//!
//! On macOS the app registers itself as a login item through `SMAppService`
//! (macOS 13+), so System Settings lists it under "Open at Login" with the
//! app's name and icon. Other platforms only build the crate for testing, so
//! the setting does nothing there.

/// Apply the user's autostart preference.
///
/// Errors are logged rather than returned: the preference is re-applied on
/// every launch, so a transient failure self-heals and must not block
/// startup.
pub fn apply_autostart(enabled: bool) {
    #[cfg(target_os = "macos")]
    macos::set_login_item(enabled);

    #[cfg(not(target_os = "macos"))]
    log::debug!("Launch at login is macOS-only; ignoring enabled={enabled}");
}

#[cfg(target_os = "macos")]
mod macos {
    use objc2_service_management::{SMAppService, SMAppServiceStatus};

    /// Register or unregister the app as a login item, skipping the call when
    /// the service is already in the requested state (unregistering a
    /// never-registered service returns an error on every launch otherwise).
    pub fn set_login_item(enabled: bool) {
        let service = unsafe { SMAppService::mainAppService() };
        let status = unsafe { service.status() };

        if enabled {
            if status == SMAppServiceStatus::Enabled {
                return;
            }
            match unsafe { service.registerAndReturnError() } {
                Ok(()) => log::info!("Registered login item via SMAppService"),
                // Fails in dev (no signed app bundle) and when the user has
                // switched the item off in System Settings, which apps are
                // not allowed to override.
                Err(e) => log::warn!("Failed to register login item: {}", e),
            }
        } else {
            if status == SMAppServiceStatus::NotRegistered || status == SMAppServiceStatus::NotFound
            {
                return;
            }
            match unsafe { service.unregisterAndReturnError() } {
                Ok(()) => log::info!("Unregistered login item via SMAppService"),
                Err(e) => log::warn!("Failed to unregister login item: {}", e),
            }
        }
    }
}
