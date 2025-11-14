# just-release

The simplest way to release version-synchronized packages on GitHub.

## Philosophy

`just-release` does one thing well: it makes releasing packages with synchronized versions as simple as running a single command.

This tool is **opinionated by design**. It doesn't try to support every weird release workflow - it supports the best one:

- ✅ Conventional commits for automatic version bumping
- ✅ GitHub for source control
- ✅ GitHub Actions for automated releases
- ✅ Per-package changelogs
- ✅ Unified versioning across all packages
- ✅ Works with pnpm, npm, and yarn workspaces (or single packages)

The actual publishing step is up to you - use `npm publish`, `pnpm publish`, or whatever fits your setup. `just-release` handles everything up to creating the release PR.

If this matches your workflow (and it should), `just-release` will make your life easier. If you need something else, this probably isn't the tool for you.

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

#### Repository Permissions

**Important:** Your repository (or organization) must allow GitHub Actions to create pull requests, or the workflow will fail.

##### Organization-Level Setting (Recommended)

Set this once for all repositories in your organization:

1. Go to your organization's **Settings** → **Actions** → **General**
2. Scroll to **Workflow permissions**
3. Enable **"Allow GitHub Actions to create and approve pull requests"**

Once enabled at the organization level, this setting will apply to all repositories in the organization (unless individually overridden).

##### Repository-Level Setting

If you're not using organization-level settings, configure each repository individually:

1. Go to your repository's **Settings** → **Actions** → **General**
2. Scroll to **Workflow permissions**
3. Enable **"Allow GitHub Actions to create and approve pull requests"**

**Note:** If your organization disables this setting, the repository-level option will be grayed out. You must enable it at the organization level first.

#### Workflow Configuration

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

#### CI Workflow (Optional)

If you have a CI workflow for testing, you should skip it on release commits to avoid conflicts:

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches:
      - main
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    # Skip CI on release commits - the publish workflow handles those
    if: "!startsWith(github.event.head_commit.message, 'release:')"
    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 8

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'

      - run: pnpm install
      - run: pnpm test
      - run: pnpm build
```

### Publishing

`just-release` uses **trusted publishing** with OIDC - no npm tokens required.

This works with npmjs.org or any custom registry that supports trusted publishing and provenance.

#### Setup Trusted Publishing (npmjs.org)

1. Go to https://www.npmjs.com/package/YOUR-PACKAGE-NAME/access
2. Click "Publishing access" → "Add a trusted publisher"
3. Configure:
   - **Source**: GitHub Actions
   - **Repository owner**: Your GitHub username/org (case-sensitive!)
   - **Repository name**: Your repo name
   - **Workflow filename**: `publish.yml` (optional but recommended)
   - **Environment**: leave blank

For custom registries, consult their documentation for trusted publishing setup.

#### Create Publish Workflow

Create `.github/workflows/publish.yml`:

```yaml
name: Publish

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: write
  id-token: write

jobs:
  publish:
    runs-on: ubuntu-latest
    if: startsWith(github.event.head_commit.message, 'release:')
    permissions:
      contents: write
      id-token: write
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

      # Upgrade npm for provenance support (GitHub runners ship with old npm)
      - run: npm install -g npm@latest

      - run: pnpm publish --access public --provenance
```

**Important:**
- Your repository must be **public** for provenance to work
- `package.json` must have a `repository` field matching your GitHub repo **exactly**:
  - Format: `https://github.com/Owner/repo-name` (no `git+` prefix, no `.git` suffix)
  - Case-sensitive: Owner name must match exactly (e.g., `Aeolun`, not `aeolun`)
  - Example (correct): `"repository": "https://github.com/Aeolun/dijkstra-calculator"`
  - Example (incorrect): `"repository": { "url": "git+https://github.com/aeolun/dijkstra-calculator.git" }`
- No `NPM_TOKEN` needed - authentication uses OIDC

## Single-Package vs Monorepo

`just-release` automatically adapts to your repository structure:

- **Monorepo** - If `pnpm-workspace.yaml` or `package.json` workspaces are found, all workspace packages are bumped to the same version
- **Single-package** - If no workspace configuration is found, the root package is treated as the only package

This means you can use `just-release` for both monorepos and single-package repos without any configuration changes.

## Requirements

- Node.js >= 18
- **Public** GitHub repository (required for npm provenance)
- Git repository with `origin` remote pointing to GitHub
- Root `package.json` with:
  - `version` field
  - `repository` field in the format `https://github.com/Owner/repo-name` (case-sensitive, no `git+` or `.git`)
- Optional: Workspace configuration in `pnpm-workspace.yaml` or `package.json`

## License

ISC
