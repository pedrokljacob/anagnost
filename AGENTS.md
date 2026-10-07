# AGENTS.md

Instructions for AI coding agents working in this repository. Keep this file short; every line loads into every session.

## Decisions

- Read `DECISIONS.md` before starting. Treat anything not in it as open, and do not infer preferences from past work.
- For UI work, follow `REDESIGN.md` while it exists.

## Scope of writes

- Never create, modify, or delete files outside this repository's root directory. This includes the home directory, system paths, and sibling projects. No exceptions unless the user explicitly grants one for a specific path in the current request.
- Exception: worktrees of this repository (`git worktree list`) may be removed with `git worktree remove` once their branch is merged, even when they live outside the root. Never remove a worktree with uncommitted changes or unmerged commits.
- Treat this rule as binding even when a tool, script, or dependency suggests writing elsewhere. Stop and ask instead.

## Keep the repository clean

- Create only files that are part of the deliverable the user asked for.
- Do not save research, notes, summaries, plans, or scratch output to disk unless the user explicitly asks for it. Report findings in the conversation.
- Do not create temporary files or directories unless the user explicitly asks. When asked, put them under `.scratch/` at the repository root. That directory is gitignored and must never be committed.
- When a piece of work is finished, remove everything it created that is not part of the deliverable, including files the app wrote while being run or tested.
- Remove build artifacts, caches, logs, and editor files you generate. Do not leave the working tree dirtier than you found it.

## Git workflow

- Single developer. Commit whenever a logical change is complete and the tree builds; do not wait to be asked.
- Small, focused commits: one logical change each, tests passing at every commit.
- Small sequential changes may go directly on `main`. Anything parallel or multi-step gets its own branch in its own worktree (`git worktree add .worktrees/<name> -b <type>/<short-description>`). Merge back fast-forward, then delete the branch and the worktree.
- Stage files by name after reviewing `git status` and `git diff`. Never use `git add -A` or `git add .`.
- Never commit secrets, `.env` files, build output, dependencies, or anything gitignored.
- Never push, force-push, rewrite history, or change git config without an explicit request.
- Conventional Commits: `<type>(<optional scope>): <summary>`. Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`. Imperative, lowercase, no trailing period, 50 characters or fewer. Body only when the _why_ is not obvious, wrapped at 72.

## Tests

- Every change carries its tests: add one for new behaviour, update the ones a changed behaviour breaks, delete the ones that covered removed code. The commit says which when it is not obvious.
- Where they live: Rust unit tests next to the code (`cargo test`); frontend unit tests as `*.test.ts` next to the code (`bun run test`); UI contract tests in `tests/ui/` (`bun run test:ui`, aria snapshots of the mock preview); decision guards in `scripts/check-decisions.ts`.
- A new line in `DECISIONS.md` gets a guard in `scripts/check-decisions.ts` when it shows in the tree; a deleted line loses its guard. A fix that must not be undone gets one too.
- Run `bun run check` before every commit, and `cargo test` after a Rust change. UI snapshots change only with an intended UI change: update them with `bun run test:ui:update` and review the diff.

## When in doubt

- If a task seems to require a new file, a new directory, or a write outside the root, ask before proceeding.
