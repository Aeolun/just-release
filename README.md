# just-release

Automated monorepo release tool with conventional commits support.

## Features

- 🔍 **Automatic workspace detection** - Works with pnpm, npm, and yarn workspaces
- 📝 **Conventional commits** - Analyzes commits to determine version bumps
- 📦 **Unified versioning** - All packages in the workspace share the same version
- 📄 **Smart changelogs** - Generates per-package changelogs only for packages with changes
- 🌿 **Git automation** - Creates release branches, commits, and pushes automatically
- 🔗 **GitHub integration** - Creates or updates PRs automatically
- 🔒 **Dry-run by default** - Safe to run locally without making changes

## Installation

```bash
pnpm add -D just-release
```

## Usage

### Local Development (Dry-run)

By default, `just-release` runs in dry-run mode when not in a CI environment:

```bash
pnpm just-release
```

This will show you what would happen without making any actual changes.

### CI Environment (Live mode)

Set `CI=1` to execute the release process:

```bash
CI=1 GITHUB_TOKEN=$GITHUB_TOKEN pnpm just-release
```

## How It Works

1. **Detects workspace** - Reads `pnpm-workspace.yaml` or `package.json` workspaces field
2. **Analyzes commits** - Gets all commits since the last release (marked by `release: X.Y.Z` commits)
3. **Calculates version bump** - Based on conventional commit types:
   - `feat:` → minor version bump
   - `fix:` → patch version bump
   - `BREAKING CHANGE:` or `feat!:` → major version bump
   - `chore:`, `docs:` → no release
4. **Generates changelogs** - Creates/updates `CHANGELOG.md` in each affected package
5. **Creates release branch** - Named `release/YYYY-MM-DD`
6. **Updates versions** - Updates `version` field in all package.json files
7. **Commits and pushes** - Creates commit with message `release: X.Y.Z`
8. **Creates/updates PR** - Opens or updates a pull request on GitHub

## Environment Variables

- `CI` - Set to `1` to run in live mode (default: dry-run)
- `GITHUB_TOKEN` - Required for creating/updating PRs (only in live mode)

## Conventional Commit Format

```
<type>: <subject>

<body>

<footer>
```

### Types

- `feat:` - New feature (minor version bump)
- `fix:` - Bug fix (patch version bump)
- `perf:` - Performance improvement (patch version bump)
- `docs:` - Documentation changes (no version bump)
- `chore:` - Maintenance tasks (no version bump)
- `test:` - Test changes (no version bump)

### Breaking Changes

Add `!` after the type or include `BREAKING CHANGE:` in the footer:

```
feat!: remove deprecated API

BREAKING CHANGE: The old API has been removed. Use the new API instead.
```

## Workflow Setup

### GitHub Actions

Create `.github/workflows/release.yml`:

```yaml
name: Release

on:
  push:
    branches:
      - main

permissions:
  contents: write
  pull-requests: write

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Required to get all commits

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install

      - name: Create release PR
        env:
          CI: 1
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: pnpm just-release
```

### Publishing

Create `.github/workflows/publish.yml` to publish when release PR is merged:

```yaml
name: Publish

on:
  push:
    branches:
      - main

permissions:
  contents: write
  id-token: write

jobs:
  publish:
    runs-on: ubuntu-latest
    # Only run if commit message starts with "release:"
    if: startsWith(github.event.head_commit.message, 'release:')
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
          registry-url: 'https://registry.npmjs.org'

      - run: pnpm install

      - run: pnpm build

      - run: pnpm publish -r --access public
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

## Single-Package vs Monorepo

`just-release` automatically adapts to your repository structure:

- **Monorepo** - If `pnpm-workspace.yaml` or `package.json` workspaces are found, all workspace packages are bumped to the same version
- **Single-package** - If no workspace configuration is found, the root package is treated as the only package

This means you can use `just-release` for both monorepos and single-package repos without any configuration changes.

## Requirements

- Node.js >= 18
- Git repository with `origin` remote pointing to GitHub
- Root `package.json` with `version` field
- Optional: Workspace configuration in `pnpm-workspace.yaml` or `package.json`

## License

ISC
