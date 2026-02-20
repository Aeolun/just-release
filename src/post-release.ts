// ABOUTME: Detects whether the current git HEAD represents a release that needs a GitHub release
// ABOUTME: Handles both squash merges (HEAD is release commit) and regular merges (release commit is a parent)

import { simpleGit } from 'simple-git';
import { isReleaseCommit } from './release-commit.js';

/**
 * Checks if the current HEAD commit represents a release.
 * Returns true if:
 * - HEAD itself is a release commit (squash merge)
 * - HEAD is a merge commit whose parent is a release commit (regular merge)
 */
export async function detectPostRelease(cwd: string): Promise<boolean> {
  const git = simpleGit(cwd);

  // Check HEAD commit
  const log = await git.log({ maxCount: 1 });
  const head = log.latest;
  if (!head) return false;

  if (isReleaseCommit(head.message)) return true;

  // If HEAD is a merge commit, check its parents
  const parents = await git.raw(['rev-list', '--parents', '-n', '1', 'HEAD']);
  const parentHashes = parents.trim().split(' ').slice(1);

  // A merge commit has 2+ parents
  if (parentHashes.length < 2) return false;

  for (const parentHash of parentHashes) {
    const message = await git.raw(['log', '--format=%s', '-n', '1', parentHash]);
    if (isReleaseCommit(message.trim())) return true;
  }

  return false;
}
