# Changelog

## 0.2.0 (2025-11-11)

### Features

- add support for single-package repos
- clarify messaging for single-package repos
- add colored path for single-package repo message
- show commit type summary after analyzing commits
- respect NO_COLOR and terminal capabilities
- format commit type summary with indented bullets
- show release branch name in dry-run summary
- add --pr flag to preview pull request content
- include all commit types in changelog
- include all commit types in PR description
- add GitHub Actions workflows for release automation
- auto-configure git in GitHub Actions
- include full commit SHA in PR description
- include commit body in PR description
- add blank line between commit title and body in PR

### Bug Fixes

- use node dist/cli.js instead of pnpm mono-release
- parse full commit message including body

### Tests

- add comprehensive color detection tests

### Chores

- initial commit

