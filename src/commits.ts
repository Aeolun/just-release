// ABOUTME: Analyzes git commits and parses conventional commit messages
// ABOUTME: Maps file changes to workspace packages for changelog generation

import { simpleGit, SimpleGit, DefaultLogFields } from 'simple-git';
import * as conventionalCommitsParser from 'conventional-commits-parser';
import { WorkspacePackage } from './workspace.js';

const { CommitParser } = conventionalCommitsParser as any;
const parser = new CommitParser();

export interface CommitInfo {
  hash: string;
  type: string | null;
  scope: string | null;
  subject: string | null;
  body: string | null;
  breaking: boolean;
  packages: string[];
  files: string[];
}

export async function analyzeCommits(
  repoPath: string,
  workspacePackages: WorkspacePackage[]
): Promise<CommitInfo[]> {
  const git: SimpleGit = simpleGit(repoPath);

  // Check if this is a shallow repository
  const isShallow = await git.raw(['rev-parse', '--is-shallow-repository']);
  if (isShallow.trim() === 'true') {
    throw new Error(
      'Shallow repository detected. just-release requires full git history.\n' +
      'Run: git fetch --unshallow'
    );
  }

  // Fetch commits in stages to optimize performance
  let log = await git.log({ maxCount: 100 });
  let releaseIndex = log.all.findIndex(c => c.message.startsWith('release: '));

  // If no release found in first 100, try 1000
  if (releaseIndex === -1 && log.total && log.total > 100) {
    log = await git.log({ maxCount: 1000 });
    releaseIndex = log.all.findIndex(c => c.message.startsWith('release: '));
  }

  // If still no release found, warn and fetch all
  if (releaseIndex === -1 && log.total && log.total > 1000) {
    console.warn('   ⚠️  No release commit found in last 1000 commits. Searching full history (this may take a while)...');
    log = await git.log();
    releaseIndex = log.all.findIndex(c => c.message.startsWith('release: '));
  }

  // Only analyze commits since last release (or all if no release found)
  const endIndex = releaseIndex === -1 ? log.all.length : releaseIndex;
  const commitsToAnalyze = log.all.slice(0, endIndex);

  const commits: CommitInfo[] = [];

  for (const commit of commitsToAnalyze) {
    // Parse conventional commit (combine message and body for full parsing)
    const fullMessage = commit.body
      ? `${commit.message}\n\n${commit.body}`
      : commit.message;
    const parsed = parser.parse(fullMessage);

    // Get files changed in this commit
    const diffSummary = await git.show([
      '--name-only',
      '--format=',
      commit.hash,
    ]);
    const files = diffSummary
      .split('\n')
      .filter((line) => line.trim().length > 0);

    // Map files to packages
    const affectedPackages = new Set<string>();

    for (const file of files) {
      for (const pkg of workspacePackages) {
        const relativePkgPath = pkg.path.replace(repoPath + '/', '');
        // For single-package repos, pkg.path === repoPath, so relativePkgPath will be unchanged
        // In that case, all files belong to the root package
        if (relativePkgPath === pkg.path) {
          // Root package - all files belong to it
          affectedPackages.add(pkg.name);
        } else if (file.startsWith(relativePkgPath)) {
          affectedPackages.add(pkg.name);
        }
      }
    }

    // Check for breaking changes
    const breaking =
      parsed.notes.some((note: any) => note.title === 'BREAKING CHANGE') ||
      commit.message.includes('!:');

    commits.push({
      hash: commit.hash,
      type: parsed.type,
      scope: parsed.scope,
      subject: parsed.subject,
      body: parsed.body,
      breaking,
      packages: Array.from(affectedPackages),
      files,
    });
  }

  // Return commits in chronological order (oldest first)
  return commits.reverse();
}
