/// Returns the CPAL host to use: the platform default (CoreAudio on macOS).
pub fn get_cpal_host() -> cpal::Host {
    cpal::default_host()
}
