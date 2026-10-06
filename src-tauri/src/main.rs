use anagnost_lib::CliArgs;
use clap::Parser;

fn main() {
    let cli_args = CliArgs::parse();

    #[cfg(target_os = "linux")]
    {
        // DMABUF renderer causes crashes on various GPU/display server configurations
        // See: https://github.com/tauri-apps/tauri/issues/9394
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    anagnost_lib::run(cli_args)
}
