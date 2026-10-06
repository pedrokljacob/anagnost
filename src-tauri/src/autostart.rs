//! Launch-at-login (autostart) handling.
//!
//! On macOS the app registers itself as a login item through `SMAppService`
//! (macOS 13+), so System Settings lists it under "Open at Login" with the
//! app's name and icon. Other platforms only build the crate for testing, so
//! the setting does nothing there.

/// Apply the user's autostart preference and confirm it took.
///
/// Returns an error when the login item could not be registered or
/// unregistered, or when the system still reports the opposite state
/// afterwards. The caller decides what to do with it: the settings toggle
/// refuses the change, while startup only logs it and retries on the next
/// launch. `interactive` is true when the user just flipped the setting, so
/// the app may open System Settings if the login item needs their approval.
pub fn apply_autostart(enabled: bool, interactive: bool) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        macos::set_login_item(enabled, interactive)
    }

    #[cfg(not(target_os = "macos"))]
    {
        let _ = interactive;
        log::debug!("Launch at login is macOS-only; ignoring enabled={enabled}");
        Ok(())
    }
}

#[cfg(target_os = "macos")]
mod macos {
    use objc2_service_management::{SMAppService, SMAppServiceStatus};

    /// Register or unregister the app as a login item, skipping the call when
    /// the service is already in the requested state (unregistering a
    /// never-registered service returns an error on every launch otherwise).
    /// The status is re-read afterwards so a silent failure is still reported.
    pub fn set_login_item(enabled: bool, interactive: bool) -> Result<(), String> {
        let service = unsafe { SMAppService::mainAppService() };
        let status = unsafe { service.status() };

        if enabled {
            if status != SMAppServiceStatus::Enabled {
                // Fails in dev (no signed app bundle) and when the user has
                // switched the item off in System Settings, which apps are
                // not allowed to override.
                unsafe { service.registerAndReturnError() }
                    .map_err(|e| format!("Could not register the login item: {e}"))?;
                log::info!("Registered login item via SMAppService");
            }
            match unsafe { service.status() } {
                SMAppServiceStatus::Enabled => {}
                // The user switched the item off in System Settings earlier;
                // only they can switch it back on, so take them there.
                SMAppServiceStatus::RequiresApproval => {
                    log::warn!("Login item needs approval in System Settings > Login Items");
                    if interactive {
                        unsafe { SMAppService::openSystemSettingsLoginItems() };
                    }
                }
                _ => return Err("The login item is not enabled after registering it".into()),
            }
        } else {
            let registered = !matches!(
                status,
                SMAppServiceStatus::NotRegistered | SMAppServiceStatus::NotFound
            );
            if registered {
                unsafe { service.unregisterAndReturnError() }
                    .map_err(|e| format!("Could not remove the login item: {e}"))?;
                log::info!("Unregistered login item via SMAppService");
            }
            if !matches!(
                unsafe { service.status() },
                SMAppServiceStatus::NotRegistered | SMAppServiceStatus::NotFound
            ) {
                return Err("The login item is still registered after removing it".into());
            }
        }
        Ok(())
    }
}
