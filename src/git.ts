// ABOUTME: Handles git operations for creating release branches and commits
// ABOUTME: Updates package.json versions across workspace packages

import { simpleGit, SimpleGit } from 'simple-git';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { WorkspacePackage } from './workspace.js';

async function ensureGitConfig(git: SimpleGit): Promise<void> {
  // Only configure if we're in GitHub Actions
  if (!process.env.GITHUB_ACTIONS) {
    return;
  }

  // Check if user.name is already configured locally (not global)
  try {
    const userName = await git.getConfig('user.name', 'local');
    const userEmail = await git.getConfig('user.email', 'local');

    // If both are configured locally, we're good
    if (userName.value && userEmail.value) {
      return;
    }
  } catch (error) {
    // Config not set, continue to set defaults
  }

  // Set github-actions[bot] as default (local config)
  await git.addConfig('user.name', 'github-actions[bot]', false, 'local');
  await git.addConfig('user.email', 'github-actions[bot]@users.noreply.github.com', false, 'local');
}

export async function createReleaseBranch(repoPath: string): Promise<{ name: string; isNew: boolean }> {
  const git: SimpleGit = simpleGit(repoPath);

  // Check if any release branch already exists
  const branches = await git.branchLocal();
  const existingReleaseBranch = branches.all.find((b) => b.startsWith('release/'));

  let branchName: string;
  let isNew: boolean;

  if (existingReleaseBranch) {
    // Reuse existing release branch
    branchName = existingReleaseBranch;
    isNew = false;
    await git.checkout(branchName);
    await git.reset(['--hard', 'HEAD']);
  } else {
    // Create new branch with current date
    const today = new Date().toISOString().split('T')[0];
    branchName = `release/${today}`;
    isNew = true;
    await git.checkoutLocalBranch(branchName);
  }

  return { name: branchName, isNew };
}

export async function updatePackageVersions(
  repoPath: string,
  newVersion: string,
  packages: WorkspacePackage[]
): Promise<void> {
  // Update root package.json
  const rootPath = join(repoPath, 'package.json');
  const rootContent = await readFile(rootPath, 'utf-8');
  const rootPackage = JSON.parse(rootContent);
  rootPackage.version = newVersion;
  await writeFile(rootPath, JSON.stringify(rootPackage, null, 2) + '\n');

  // Update workspace packages (skip root if it's in the packages list)
  for (const pkg of packages) {
    // Skip if this package is the root (single-package repo)
    if (pkg.path === repoPath) {
      continue;
    }

    const pkgPath = join(pkg.path, 'package.json');
    const pkgContent = await readFile(pkgPath, 'utf-8');
    const pkgJson = JSON.parse(pkgContent);
    pkgJson.version = newVersion;
    await writeFile(pkgPath, JSON.stringify(pkgJson, null, 2) + '\n');
  }
}

export async function commitAndPush(
  repoPath: string,
  newVersion: string,
  push: boolean
): Promise<void> {
  const git: SimpleGit = simpleGit(repoPath);

  // Ensure git is configured (auto-configure in GitHub Actions if needed)
  await ensureGitConfig(git);

  // Stage all changes
  await git.add('.');

  // Commit with release message
  await git.commit(`release: ${newVersion}`);

  if (push) {
    // Push to remote (force push to update existing branch)
    const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']);
    await git.push('origin', currentBranch.trim(), ['--force', '--set-upstream']);
  }
}
