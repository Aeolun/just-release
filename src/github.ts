// ABOUTME: Manages GitHub API interactions for PR creation and updates
// ABOUTME: Handles release branch detection and repository information extraction

import { Octokit } from '@octokit/rest';
import { simpleGit, SimpleGit } from 'simple-git';

export interface RepoInfo {
  owner: string;
  repo: string;
}

export async function getRepoInfo(repoPath: string): Promise<RepoInfo> {
  const git: SimpleGit = simpleGit(repoPath);
  const remotes = await git.getRemotes(true);

  const origin = remotes.find((r) => r.name === 'origin');
  if (!origin) {
    throw new Error('No origin remote found');
  }

  const url = origin.refs.fetch || origin.refs.push || '';

  // Parse GitHub URL (supports both HTTPS and SSH)
  let match = url.match(/github\.com[:/]([^/]+)\/([^/.]+)(\.git)?$/);

  if (!match) {
    throw new Error(`Could not parse GitHub repo from remote URL: ${url}`);
  }

  return {
    owner: match[1],
    repo: match[2],
  };
}

export function findExistingReleaseBranch(
  branches: Array<{ name: string }>
): string | null {
  const releaseBranch = branches.find((b) => b.name.startsWith('release/'));
  return releaseBranch ? releaseBranch.name : null;
}

export async function createOrUpdatePR(
  repoPath: string,
  branchName: string,
  version: string,
  changelogSummary: string,
  token: string
): Promise<string> {
  const octokit = new Octokit({ auth: token });
  const repoInfo = await getRepoInfo(repoPath);

  // List all branches to find existing release PR
  const { data: branches } = await octokit.repos.listBranches({
    owner: repoInfo.owner,
    repo: repoInfo.repo,
  });

  const existingReleaseBranch = findExistingReleaseBranch(branches);

  // Get default branch (usually main or master)
  const { data: repo } = await octokit.repos.get({
    owner: repoInfo.owner,
    repo: repoInfo.repo,
  });
  const baseBranch = repo.default_branch;

  const title = `Release ${version}`;
  const body = `## Release ${version}\n\n${changelogSummary}`;

  if (existingReleaseBranch) {
    // Find existing PR for this branch
    const { data: prs } = await octokit.pulls.list({
      owner: repoInfo.owner,
      repo: repoInfo.repo,
      head: `${repoInfo.owner}:${existingReleaseBranch}`,
      base: baseBranch,
      state: 'open',
    });

    if (prs.length > 0) {
      // Update existing PR
      const pr = prs[0];
      await octokit.pulls.update({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
        pull_number: pr.number,
        title,
        body,
      });

      return pr.html_url;
    }
  }

  // Create new PR
  const { data: pr } = await octokit.pulls.create({
    owner: repoInfo.owner,
    repo: repoInfo.repo,
    head: branchName,
    base: baseBranch,
    title,
    body,
  });

  return pr.html_url;
}

export async function createGitHubRelease(
  repoPath: string,
  version: string,
  releaseNotes: string,
  token: string
): Promise<string> {
  const octokit = new Octokit({ auth: token });
  const repoInfo = await getRepoInfo(repoPath);

  const tagName = `v${version}`;

  // Create the release
  const { data: release } = await octokit.repos.createRelease({
    owner: repoInfo.owner,
    repo: repoInfo.repo,
    tag_name: tagName,
    name: `Release ${version}`,
    body: releaseNotes,
    draft: false,
    prerelease: false,
  });

  return release.html_url;
}
