# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`just-release` is an opinionated automated release tool for GitHub repositories (both monorepos and single-package projects). It analyzes conventional commits to determine version bumps, generates per-package changelogs, and creates release PRs automatically.

Philosophy: Does one thing well - makes releasing version-synchronized packages simple. Works with pnpm, npm, and yarn workspaces or single packages.

## Development Commands

### Building and Testing
- `pnpm build` - Compile TypeScript to dist/ directory
- `pnpm dev` - Watch mode (continuous compilation)
- `pnpm test` - Run all tests using Node's built-in test runner with tsx
- `node --import tsx --test src/path/to/file.test.ts` - Run a single test file

### Running Locally
- `node dist/cli.js` - Run in dry-run mode (shows what would happen)
- `node dist/cli.js --pr` - Dry-run with PR preview
- `CI=1 GITHUB_TOKEN=xxx node dist/cli.js` - Live mode (executes changes)

Note: Build before running (`pnpm build` first), or use `NO_COLOR=1 node` to disable color output.

## Architecture

The codebase follows a modular, pipeline-based architecture with clear separation of concerns:

### Main Workflow (cli.ts)
Entry point that orchestrates the release process in sequential steps:
1. Detect workspace configuration
2. Analyze commits since last release
3. Calculate version bump
4. Generate changelogs
5. Create/reuse release branch
6. Update package.json versions
7. Commit and push
8. Create/update GitHub PR

**Post-release mode**: When run on a commit starting with "release:", automatically creates a GitHub release with changelog notes.

### Core Modules

**workspace.ts** - Workspace Detection
- Detects monorepo configuration from `pnpm-workspace.yaml` or `package.json` workspaces
- Falls back to single-package mode if no workspace config found
- Returns unified workspace info: root version, all packages with paths

**commits.ts** - Commit Analysis
- Fetches git commits since last release (identified by "release: X.Y.Z" commits)
- Parses conventional commit format using `conventional-commits-parser`
- Maps changed files to affected workspace packages
- Detects breaking changes (via `!:` or `BREAKING CHANGE:` footer)
- Returns commits in chronological order (oldest first)
- Validates full git history is available (not shallow clone)

**version.ts** - Version Calculation
- Determines semver bump type based on commit types:
  - Breaking changes → major
  - `feat:` → minor
  - `fix:` or `perf:` → patch
  - `chore:`, `docs:`, etc. → no release
- Returns null bump type if only non-releasable commits

**changelog.ts** - Changelog Generation
- Groups commits by package (based on file changes)
- Generates markdown changelogs per package (only for packages with changes)
- Sections: Breaking Changes, Features, Bug Fixes, Performance, Tests, Docs, Refactoring, Chores, Style, Build, CI
- Prepends new version section to existing CHANGELOG.md

**git.ts** - Git Operations
- Creates or reuses release branches (named `release/YYYY-MM-DD`)
- Updates version field in all package.json files
- Auto-configures git user in GitHub Actions if needed
- Force pushes to release branch (to update existing PRs)

**github.ts** - GitHub Integration
- Parses repo owner/name from git remote URL
- Creates or updates PRs for release branches
- Closes old release PRs when creating new ones
- Creates GitHub releases with changelog notes (post-release mode)

**colors.ts** - Terminal Colors
- Provides ANSI color codes for terminal output
- Respects NO_COLOR environment variable and TTY detection

## Key Concepts

### Unified Versioning
All packages in a workspace share the same version. The root package.json version is the source of truth.

### Release Commit Marker
Commits with message "release: X.Y.Z" mark release points. The tool finds commits since the last such marker.

### Dry-Run vs Live Mode
- Default (local): Dry-run mode - shows what would happen without making changes
- `CI=1`: Live mode - executes all git/GitHub operations
- Set `GITHUB_TOKEN` for PR creation in live mode

### Package Change Detection
Commits are mapped to packages by analyzing which files changed. A commit affects a package if any changed file is under that package's directory.

### Release Branch Strategy
- One active release branch at a time (closes old ones when creating new)
- Branches named by date: `release/2024-01-15`
- Reuses existing release branch if found (resets to current main state)
- Force pushes to update the branch (safe because PR is always regenerated)

## Testing

- Tests use Node's built-in test runner (node:test)
- All modules have corresponding `.test.ts` files
- Tests are excluded from TypeScript compilation (tsconfig.json)
- Run tests with `--import tsx` to handle TypeScript at runtime

## TypeScript Configuration

- ES2022 modules (ESM only, uses .js extensions in imports)
- Strict mode enabled
- Output to dist/ directory
- Generates declaration files and source maps
