# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Package Manager

This project uses **pnpm**. Do not use npm or yarn.

## Commands

```bash
pnpm install          # Install dependencies
pnpm build            # Compile TypeScript → dist/
pnpm dev              # Watch mode (tsc --watch)
pnpm test             # Run all tests
```

Run a single test file:
```bash
node --import tsx --test src/changelog.test.ts
```

## Architecture

**just-release** is a release automation CLI for monorepos and single-package repos. It analyzes conventional commits, calculates semver bumps, generates changelogs, and creates GitHub PRs.

### Module Flow

The CLI (`cli.ts`) orchestrates these modules in order:

1. **workspace.ts** — Detects pnpm/npm/yarn workspace structure or falls back to single root package
2. **commits.ts** — Fetches commits since last release, parses conventional commits, maps file changes to packages
3. **version.ts** — Determines bump type from commit types (feat→minor, fix/perf→patch, breaking→major, chore/docs→skip)
4. **changelog.ts** — Generates per-package markdown changelogs grouped by commit type
5. **git.ts** — Creates release branch (`release/YYYY-MM-DD`), updates package.json versions, commits and force-pushes
6. **github.ts** — Creates/updates PR via Octokit, closes stale release PRs, creates GitHub releases

Supporting modules:
- **release-commit.ts** — Detects release markers in commit history (supports `release: X.Y.Z`, `chore: release vX.Y.Z`, etc.)
- **colors.ts** — TTY color detection respecting `NO_COLOR` standard

### Two Execution Modes

- **Dry-run** (default, `CI` unset): Logs what would happen, no side effects
- **Live** (`CI=1`): Executes the full release workflow, requires `GITHUB_TOKEN`

### Post-Release Mode

When the current HEAD commit is a release commit, the tool switches to post-release mode: it reads the changelog and creates/updates a GitHub Release.

### Non-Conventional Commit Handling

Commits not matching `type: subject` format get `type: null` and `subject: null` from the parser. These are displayed using `rawMessage` (the original first line) and grouped under "### Other" in changelogs. The `CommitInfo` interface normalizes parser output to `null` (not `undefined`).

## Test Conventions

- Framework: Node's native `node:test` with `node:assert`
- TypeScript execution via `tsx` loader
- Tests co-located with source: `src/foo.ts` → `src/foo.test.ts`
- Integration tests in `commits.test.ts` and `git.test.ts` create real temporary git repos
- `CommitInfo` objects in tests must include all fields including `rawMessage`
