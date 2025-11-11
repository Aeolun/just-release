// ABOUTME: Handles git operations for creating release branches and commits
// ABOUTME: Updates package.json versions across workspace packages

import { simpleGit, SimpleGit } from 'simple-git';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { WorkspacePackage } from './workspace.js';

export async function createReleaseBranch(repoPath: string): Promise<string> {
  const git: SimpleGit = simpleGit(repoPath);

  // Generate branch name with current date
  const today = new Date().toISOString().split('T')[0];
  const branchName = `release/${today}`;

  // Check if branch already exists
  const branches = await git.branchLocal();

  if (branches.all.includes(branchName)) {
    // Branch exists, switch to it and reset to main
    await git.checkout(branchName);
    await git.reset(['--hard', 'HEAD']);
  } else {
    // Create new branch
    await git.checkoutLocalBranch(branchName);
  }

  return branchName;
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
