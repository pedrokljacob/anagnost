// Guards for the decisions in DECISIONS.md and for fixes that must not be
// undone. Each block names the decision or commit it protects. Run with
// `bun run check:decisions`; it reads the tree only and takes well under a
// second, so it runs in CI on every push.
//
// When a decision line is added to DECISIONS.md, add a guard here if the
// decision shows in the tree. Delete the guard with the decision.

import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = join(import.meta.dir, "..");
const failures: string[] = [];
const fail = (message: string) => failures.push(message);

const read = (path: string) => readFileSync(join(root, path), "utf8");
const exists = (path: string) => existsSync(join(root, path));

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(join(root, dir))) {
    const path = join(dir, entry);
    if (statSync(join(root, path)).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
};

const expect = (path: string, pattern: RegExp, why: string, present = true) => {
  const found = pattern.test(read(path));
  if (found !== present) {
    fail(
      `${path}: ${present ? "missing" : "must not contain"} ${pattern} (${why})`,
    );
  }
};

// DECISIONS: "Agent instructions live in AGENTS.md only" and "Not shipped:
// auto-updater, What's New, remote-control CLI flags..."; the Windows and
// Linux packaging was removed with the macOS-only decision.
for (const path of [
  "CLAUDE.md",
  "CRUSH.md",
  ".cursorrules",
  "src-tauri/windows",
  "src-tauri/nsis",
  "flake.nix",
  "src-tauri/src/updater.rs",
]) {
  if (exists(path))
    fail(`${path} exists (removed on purpose, see DECISIONS.md)`);
}
expect(
  "src-tauri/Cargo.toml",
  /tauri-plugin-updater/,
  "no auto-updater",
  false,
);
expect("package.json", /plugin-updater/, "no auto-updater", false);

// DECISIONS: app name, bundle identifier, author; macOS only, Apple Silicon,
// macOS 13 or later; shipped as app and dmg.
{
  const conf = JSON.parse(read("src-tauri/tauri.conf.json"));
  const checks: [string, unknown, unknown][] = [
    ["productName", conf.productName, "Anagnost"],
    ["identifier", conf.identifier, "com.pedrojacob.anagnost"],
    ["bundle.targets", JSON.stringify(conf.bundle?.targets), '["app","dmg"]'],
    [
      "bundle.macOS.minimumSystemVersion",
      conf.bundle?.macOS?.minimumSystemVersion,
      "13.0",
    ],
    ["bundle.macOS.hardenedRuntime", conf.bundle?.macOS?.hardenedRuntime, true],
  ];
  for (const [key, actual, wanted] of checks) {
    if (actual !== wanted) {
      fail(
        `tauri.conf.json ${key} is ${JSON.stringify(actual)}, expected ${JSON.stringify(wanted)}`,
      );
    }
  }
  const pkg = JSON.parse(read("package.json"));
  if (pkg.name !== "anagnost") fail(`package.json name is ${pkg.name}`);
}
expect("src-tauri/Cargo.toml", /^name = "anagnost"$/m, "crate name");
expect("src-tauri/Cargo.toml", /^name = "anagnost_lib"$/m, "lib name");
expect("src-tauri/Cargo.toml", /^authors = \["Pedro"\]$/m, "author");
expect("scripts/install-mac.sh", /^MIN_MACOS=13$/m, "macOS 13 or later");
expect("scripts/install-mac.sh", /hw\.optional\.arm64/, "Apple Silicon only");

// DECISIONS: build size. Dev profile keeps line tables only, no debuginfo
// for dependencies or build scripts; the crate builds as rlib only.
expect(
  "src-tauri/Cargo.toml",
  /^\[profile\.dev\]\s*\n(#.*\n)*debug = "line-tables-only"$/m,
  "dev debuginfo",
);
expect(
  "src-tauri/Cargo.toml",
  /^\[profile\.dev\.package\."\*"\]\s*\ndebug = false$/m,
  "dependency debuginfo",
);
expect(
  "src-tauri/Cargo.toml",
  /^\[profile\.dev\.build-override\]\s*\n(#.*\n)*debug = false$/m,
  "build script debuginfo",
);
expect("src-tauri/Cargo.toml", /^crate-type = \["rlib"\]$/m, "rlib only");

// DECISIONS: English only, with react-i18next and the lint rule kept.
{
  const locales = readdirSync(join(root, "src/i18n/locales"));
  if (locales.join() !== "en")
    fail(`locales are ${locales.join(", ")}, expected en only`);
  expect(
    "eslint.config.js",
    /i18next\/no-literal-string/,
    "literal-string lint rule",
  );
}

// DECISIONS: history keeps the last 5 entries plus starred ones, no setting;
// the sound picker is gone and Marimba is the only sound; no in-app theme
// choice (theme follows the system).
expect(
  "src-tauri/src/managers/history.rs",
  /^const HISTORY_LIMIT: usize = 5;$/m,
  "history limit",
);
{
  const wavs = readdirSync(join(root, "src-tauri/resources")).filter((f) =>
    f.endsWith(".wav"),
  );
  if (wavs.sort().join() !== "marimba_start.wav,marimba_stop.wav") {
    fail(`resources hold ${wavs.join(", ")}; only the two Marimba sounds ship`);
  }
}
for (const key of ["history_limit", "sound_theme", "theme"]) {
  expect(
    "src/bindings.ts",
    new RegExp(`^\\s*${key}\\??:`, "m"),
    `no ${key} setting`,
    false,
  );
}

// DECISIONS: "Kept as Handy on purpose: the handy-keys crate and its wrappers,
// model hosting, upstream issue references and code comments." Everything
// the user can see is Anagnost. Checks user-facing files whole, and source
// files with comments stripped; `HandyKeys*` identifiers pass the word
// boundary. Commit 87cf7f0 fixed the mock after a merge brought Handy back.
{
  const userFacing = [
    "index.html",
    "src/overlay/index.html",
    "src/i18n/locales/en/translation.json",
    "src-tauri/tauri.conf.json",
    "src-tauri/Info.plist",
    "src-tauri/Entitlements.plist",
    "package.json",
    "scripts/install-mac.sh",
    "scripts/uninstall.sh",
  ];
  const sources = walk("src").filter(
    (p) => /\.(ts|tsx|css)$/.test(p) && p !== "src/bindings.ts",
  );
  const stripComments = (code: string) =>
    code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:\\])\/\/.*$/gm, "$1");
  for (const path of [...userFacing, ...sources]) {
    const text = userFacing.includes(path)
      ? read(path)
      : stripComments(read(path));
    const hit = text.match(/\bHandy\b(?![-_.]?keys|[-.]computer)|com\.pais\b/i);
    if (hit)
      fail(`${path}: contains "${hit[0]}" (user-facing text is Anagnost)`);
  }
}

// DECISIONS: the hidden Debug section stays behind Cmd+Shift+D with no
// visible control; the Experimental switch is gone.
expect(
  "src/App.tsx",
  /event\.shiftKey &&\s*event\.key\.toLowerCase\(\) === "d"/,
  "debug toggle shortcut",
);
expect("src/bindings.ts", /^\s*experimental/m, "no experimental switch", false);

// DECISIONS: Linux is a test bench; the headless --transcribe-file mode stays.
expect(
  "src-tauri/src/cli.rs",
  /transcribe_file: Option<PathBuf>/,
  "headless mode",
);

// Fixes in the install and uninstall scripts that must stay (commits 0160ecf,
// a6438a3, 9a6784a, b412ad1, 3265a62).
expect(
  "scripts/install-mac.sh",
  /codesign --verify --deep --strict/,
  "integrity check",
);
expect("scripts/install-mac.sh", /Signature=adhoc/, "refuse ad-hoc signatures");
expect(
  "scripts/install-mac.sh",
  /^trap cleanup EXIT$/m,
  "restore the old app on failure",
);
expect(
  "scripts/install-mac.sh",
  /AnagnostCommit/,
  "report the installed commit",
);
expect(
  "scripts/uninstall.sh",
  /<\/dev\/tty/,
  "confirmation works under curl | bash",
);
expect(
  "scripts/uninstall.sh",
  /^BUNDLE_ID="com\.pedrojacob\.anagnost"$/m,
  "bundle id",
);
{
  const script = read("scripts/uninstall.sh");
  const reset = script.search(/tccutil reset All "\$BUNDLE_ID"/);
  const remove = script.search(/^\s*(if ! )?rm -rf "\$path"/m);
  if (reset < 0) fail("uninstall.sh: permissions are no longer reset");
  else if (remove >= 0 && reset > remove) {
    fail(
      "uninstall.sh: tccutil must run before the app is deleted (it needs the bundle)",
    );
  }
}

// Fixes in CI that must stay (commits f0f99d9, 271c711): the signing keychain
// never auto-locks, the release is updated in place, latest.txt goes last.
{
  const ci = read(".github/workflows/ci.yml");
  if (/gh release delete/.test(ci))
    fail("ci.yml: the latest release must be updated in place, never deleted");
  if (!/^\s*security set-keychain-settings "\$KEYCHAIN"$/m.test(ci)) {
    fail("ci.yml: the signing keychain must have no auto-lock timeout");
  }
  const dmg = ci.indexOf('upload latest "$RUNNER_TEMP/$ASSET" --clobber');
  const txt = ci.indexOf('upload latest "$RUNNER_TEMP/latest.txt" --clobber');
  if (dmg < 0 || txt < 0 || txt < dmg)
    fail("ci.yml: latest.txt must be uploaded with --clobber after the dmg");
}

// Translation keys: every key the code uses exists, and every key in the
// file is used (commit 11dceaf removed keys left behind by deletions).
// Dynamic keys are built from the prefixes below.
{
  const translation = JSON.parse(read("src/i18n/locales/en/translation.json"));
  const defined = new Set<string>();
  const collect = (node: unknown, prefix: string) => {
    if (typeof node === "string") defined.add(prefix);
    else if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node))
        collect(v, prefix ? `${prefix}.${k}` : k);
    }
  };
  collect(translation, "");

  const dynamicPrefixes = [
    "onboarding.models.", // modelTranslation.ts, by model id
    "tray.", // src-tauri/build.rs generates the tray strings from this block
  ];
  const used = new Set<string>();
  const sources = walk("src").filter(
    (p) => /\.(ts|tsx)$/.test(p) && !p.endsWith(".test.ts"),
  );
  for (const path of sources) {
    const text = read(path);
    for (const m of text.matchAll(
      /["'`]([a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9_-]+)+)["'`]/g,
    ))
      used.add(m[1]);
    // Template keys: t(`secureInput.blocked_${n}`) uses the prefix before ${.
    for (const m of text.matchAll(
      /`([a-zA-Z][a-zA-Z0-9]*(?:\.[a-zA-Z0-9_]+)*[._])\$\{/g,
    ))
      dynamicPrefixes.push(m[1]);
  }
  const isDynamic = (key: string) =>
    dynamicPrefixes.some((p) => key.startsWith(p));
  for (const key of used) {
    if (
      !defined.has(key) &&
      !isDynamic(key) &&
      /^[a-z]/.test(key) &&
      !key.includes("/")
    ) {
      const parent = key.split(".").slice(0, -1).join(".");
      // Only report keys whose namespace exists, so dotted non-keys
      // (versions, hostnames, nested object paths) stay out.
      if ([...defined].some((d) => d.startsWith(`${parent}.`)))
        fail(`translation key used but not defined: ${key}`);
    }
  }
  for (const key of defined) {
    if (!used.has(key) && !isDynamic(key))
      fail(`translation key defined but unused: ${key}`);
  }
}

// Mock backend contract: every command the browser preview answers by name
// exists in the generated bindings, so a renamed command cannot leave the
// preview silently returning null (commit 11b8532 fixed such a drift).
{
  const bindings = read("src/bindings.ts");
  const commands = new Set(
    [...bindings.matchAll(/TAURI_INVOKE\("([a-z_]+)"/g)].map((m) => m[1]),
  );
  const mock = read("src/dev/mock/index.ts");
  for (const m of mock.matchAll(/case "([a-z_]+)":/g)) {
    if (!commands.has(m[1]))
      fail(
        `src/dev/mock/index.ts answers "${m[1]}", which is not a command in bindings.ts`,
      );
  }
}

if (failures.length > 0) {
  console.error("Decision guards failed:\n");
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log("Decision guards: all passed");
