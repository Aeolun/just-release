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

  // Get all commits
  const log = await git.log();

  // Find the most recent release commit (message starts with "release: ")
  let endIndex = log.all.length; // Take all commits by default
  for (let i = 0; i < log.all.length; i++) {
    if (log.all[i].message.startsWith('release: ')) {
      endIndex = i; // Stop before the release commit
      break;
    }
  }

  // Only analyze commits since last release (or all if no release found)
  const commitsToAnalyze = log.all.slice(0, endIndex);

  const commits: CommitInfo[] = [];

  for (const commit of commitsToAnalyze) {
    // Parse conventional commit
    const parsed = parser.parse(commit.message);

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
        if (file.startsWith(relativePkgPath)) {
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
