// ABOUTME: Git-based version resolution independent of any ecosystem manifest
// ABOUTME: Priority: last release commit → latest vX.Y.Z git tag → 0.0.0

import { simpleGit } from 'simple-git';
import { extractVersionFromCommit, isReleaseCommit } from './release-commit.js';

export async function resolveCurrentVersion(
  repoPath: string
): Promise<string> {
  const git = simpleGit(repoPath);

  // Strategy 1: Find last release commit (progressive search)
  let log = await git.log({ maxCount: 100 });
  for (const commit of log.all) {
    if (isReleaseCommit(commit.message)) {
      const version = extractVersionFromCommit(commit.message);
      if (version) return version;
    }
  }

  if (log.total && log.total > 100) {
    log = await git.log({ maxCount: 1000 });
    // Start from 100 since we already checked those
    for (let i = 100; i < log.all.length; i++) {
      const commit = log.all[i];
      if (isReleaseCommit(commit.message)) {
        const version = extractVersionFromCommit(commit.message);
        if (version) return version;
      }
    }
  }

  if (log.total && log.total > 1000) {
    log = await git.log();
    for (let i = 1000; i < log.all.length; i++) {
      const commit = log.all[i];
      if (isReleaseCommit(commit.message)) {
        const version = extractVersionFromCommit(commit.message);
        if (version) return version;
      }
    }
  }

  // Strategy 2: Find latest semver git tag
  try {
    const tags = await git.tags(['--sort=-v:refname']);
    for (const tag of tags.all) {
      const match = tag.match(/^v?(\d+\.\d+\.\d+(?:-[a-zA-Z0-9.]+)?)$/);
      if (match) return match[1];
    }
  } catch {
    // No tags, fall through
  }

  // Strategy 3: Default
  return '0.0.0';
}
