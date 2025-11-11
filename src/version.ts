// ABOUTME: Calculates version bumps based on conventional commit types
// ABOUTME: Determines major, minor, or patch semver increments

import semver from 'semver';
import { CommitInfo } from './commits.js';

export type BumpType = 'major' | 'minor' | 'patch' | null;

export interface VersionBumpResult {
  bumpType: BumpType;
  newVersion: string | null;
}

const RELEASE_TYPES = ['feat', 'fix', 'perf'];
const SKIP_TYPES = ['chore', 'docs', 'style', 'refactor', 'test', 'build', 'ci'];

export function calculateVersionBump(
  currentVersion: string,
  commits: CommitInfo[]
): VersionBumpResult {
  if (commits.length === 0) {
    return { bumpType: null, newVersion: null };
  }

  let bumpType: BumpType = null;

  // Check for breaking changes first (major bump)
  const hasBreaking = commits.some((c) => c.breaking);
  if (hasBreaking) {
    bumpType = 'major';
  } else {
    // Check for features (minor bump)
    const hasFeat = commits.some((c) => c.type === 'feat');
    if (hasFeat) {
      bumpType = 'minor';
    } else {
      // Check for fixes or performance improvements (patch bump)
      const hasFix = commits.some(
        (c) => c.type === 'fix' || c.type === 'perf'
      );
      if (hasFix) {
        bumpType = 'patch';
      }
    }
  }

  // If only chore/docs/etc commits, don't bump
  if (bumpType === null) {
    return { bumpType: null, newVersion: null };
  }

  const newVersion = semver.inc(currentVersion, bumpType);

  return {
    bumpType,
    newVersion,
  };
}
