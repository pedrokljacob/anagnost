use anagnost_lib::CliArgs;
use clap::Parser;

fn main() {
    let cli_args = CliArgs::parse();

    anagnost_lib::run(cli_args)
}
