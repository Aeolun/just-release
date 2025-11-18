// ABOUTME: Utilities for detecting release commits and extracting version numbers
// ABOUTME: Supports multiple commit message formats (release:, chore: release, etc.)

/**
 * Checks if a commit message indicates a release
 * Supports formats like:
 * - "release: 1.2.3"
 * - "chore: release v1.2.3"
 * - "release v1.2.3"
 * - "chore(release): v1.2.3"
 */
export function isReleaseCommit(message: string): boolean {
  // Pattern: word "release" (not "released" or "releases") followed immediately by
  // whitespace/colon/paren, then optional "v", then semver version
  // Limits characters between "release" and version to avoid false matches like
  // "docs: release notes for v1.2.3" or "chore: update release script"
  const releasePattern = /\brelease\b[\s:)]{0,3}v?\d+\.\d+\.\d+(?:\-[a-zA-Z0-9.]+)?/i;
  return releasePattern.test(message);
}

/**
 * Extracts the version number from a release commit message
 * Returns null if the message is not a release commit
 */
export function extractVersionFromCommit(message: string): string | null {
  if (!isReleaseCommit(message)) {
    return null;
  }

  // Extract semver version (with optional "v" prefix and prerelease suffix)
  const versionPattern = /v?(\d+\.\d+\.\d+(?:\-[a-zA-Z0-9.]+)?)/;
  const match = message.match(versionPattern);

  return match ? match[1] : null;
}
