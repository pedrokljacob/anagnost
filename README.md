<img src="assets/icon.svg" width="64" height="64" alt="">

# Anagnost

Created in [T3 Code](https://t3.codes).

A macOS dictation app built on a fork of [Handy](https://github.com/cjpais/Handy) by CJ Pais (MIT, see `LICENSE`). Build instructions are in `BUILD.md`.

## Install or update

Every push to `main` publishes a new build (about 8 minutes). To install it,
or replace the installed app with the latest build, run in Terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/pedrokljacob/anagnost/main/scripts/install-mac.sh | bash
```

## Uninstall

Turn off "Launch at login" in the app and quit it, then run:

```bash
bash <(curl -fsSL https://raw.githubusercontent.com/pedrokljacob/anagnost/main/scripts/uninstall.sh) --app
```

It lists everything it will delete and asks before deleting. Details are in
`BUILD.md`.
