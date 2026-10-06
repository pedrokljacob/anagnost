# AGENTS.md

Instructions for AI coding agents working in this repository. Keep this file short; every line loads into every session.

## Scope of writes

- Never create, modify, or delete files outside this repository's root directory. This includes the home directory, system paths, and sibling projects. No exceptions unless the user explicitly grants one for a specific path in the current request.
- Treat this rule as binding even when a tool, script, or dependency suggests writing elsewhere. Stop and ask instead.

## Keep the repository clean

- Create only files that are part of the deliverable the user asked for.
- Do not save research, notes, summaries, plans, or scratch output to disk unless the user explicitly asks for it. Report findings in the conversation.
- Do not create temporary files or directories unless the user explicitly asks. When asked, put them under `.scratch/` at the repository root. That directory is gitignored and must never be committed.
- Delete anything you were allowed to create temporarily once the task is complete.
- Remove build artifacts, caches, logs, and editor files you generate. Do not leave the working tree dirtier than you found it.

## Git workflow

- `main` is always releasable. Never commit directly to `main`; work on a short-lived branch named `<type>/<short-description>` (for example `feat/parser`, `fix/empty-input`).
- Commit only when the user asks. Never push, force-push, rebase shared history, amend published commits, or change git config without an explicit request.
- Make small, focused commits. One logical change per commit, with the tree building and tests passing at each commit.
- Stage files by name. Never use `git add -A` or `git add .`; review `git status` and `git diff` before every commit.
- Never commit secrets, credentials, `.env` files, build output, dependencies, or anything in `.gitignore`.
- Write commit messages in Conventional Commits format: `<type>(<optional scope>): <summary>`. Types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`. Summary in imperative mood, lowercase, no trailing period, 50 characters or fewer. Add a body only when the *why* is not obvious; wrap at 72 characters.
- Integrate into `main` with a pull request or a fast-forward merge after review. Delete the branch after merging.

## When in doubt

- If a task seems to require a new file, a new directory, a write outside the root, or any git operation not listed above, ask before proceeding.
