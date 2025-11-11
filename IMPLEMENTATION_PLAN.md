# mono-release Implementation Plan

## Project Setup
- [ ] Initialize pnpm project with package.json
- [ ] Configure TypeScript (tsconfig.json)
- [ ] Set up bin entry point in package.json
- [ ] Install dependencies:
  - [ ] conventional-commits-parser
  - [ ] semver
  - [ ] @octokit/rest
  - [ ] simple-git
  - [ ] yaml
- [ ] Set up build script (tsc)
- [ ] Configure test framework

## Core Modules

### Workspace Detection (src/workspace.ts)
- [ ] Read pnpm-workspace.yaml if exists
- [ ] Read package.json workspaces field if no pnpm-workspace.yaml
- [ ] Resolve glob patterns to find all workspace packages
- [ ] Validate root package.json exists
- [ ] Validate root package.json has version field
- [ ] Return list of workspace package paths

### Git Commit Analysis (src/commits.ts)
- [ ] Get current version from root package.json
- [ ] Fetch all commits since last release (git log)
- [ ] Parse each commit with conventional-commits-parser
- [ ] Categorize commits (feat, fix, BREAKING CHANGE, chore, docs, etc.)
- [ ] Track which files changed in each commit
- [ ] Map file changes to workspace packages
- [ ] Return structured commit data with package associations

### Version Bump Calculation (src/version.ts)
- [ ] Analyze commit types to determine bump level
- [ ] BREAKING CHANGE → major bump
- [ ] feat → minor bump
- [ ] fix → patch bump
- [ ] Skip release if only chore/docs commits
- [ ] Calculate new version using semver
- [ ] Return new version or null if no bump needed

### Changelog Generation (src/changelog.ts)
- [ ] Group commits by package
- [ ] Generate markdown sections for each commit type (Features, Fixes, Breaking Changes)
- [ ] Read existing CHANGELOG.md if present
- [ ] Prepend new version section with date
- [ ] Write updated CHANGELOG.md to each affected package
- [ ] Skip packages with no changes

### Git Operations (src/git.ts)
- [ ] Check current git status
- [ ] Create release branch name: release/YYYY-MM-DD
- [ ] Checkout main/master branch
- [ ] Create or reset release branch
- [ ] Update all package.json files with new version
- [ ] Stage all changes
- [ ] Commit with message: "release: X.Y.Z"
- [ ] Push to remote (force push if updating existing)

### GitHub Integration (src/github.ts)
- [ ] Initialize Octokit with GITHUB_TOKEN
- [ ] Get repository owner and name from git remote
- [ ] List all branches via GitHub API
- [ ] Find existing release/* branch
- [ ] Create new PR if none exists
- [ ] Update existing PR if found
- [ ] Set PR title: "Release X.Y.Z"
- [ ] Set PR body with changelog summary

### CLI Entry Point (src/cli.ts)
- [ ] Parse command line arguments
- [ ] Check CI environment variable
- [ ] Implement dry-run mode (default when CI !== "1")
- [ ] In dry-run: log all operations without executing
- [ ] In live mode: execute all operations
- [ ] Handle errors and provide clear messages
- [ ] Exit with appropriate status codes

## Testing
- [ ] Write tests for workspace detection
- [ ] Write tests for commit parsing
- [ ] Write tests for version calculation
- [ ] Write tests for changelog generation
- [ ] Write tests for git operations (mocked)
- [ ] Write tests for GitHub API (mocked)
- [ ] Write integration test for full flow

## Documentation
- [ ] Write README.md with usage instructions
- [ ] Document environment variables (GITHUB_TOKEN)
- [ ] Document dry-run vs live mode
- [ ] Add examples of conventional commit format
- [ ] Document expected workflow setup

## Edge Cases to Handle
- [ ] No commits since last release
- [ ] Only chore/docs commits (skip release)
- [ ] Mixed breaking changes with features
- [ ] No root package.json or missing version
- [ ] Git authentication issues
- [ ] GitHub API rate limiting
- [ ] Invalid conventional commits
- [ ] Merge conflicts on release branch
