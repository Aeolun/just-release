// ABOUTME: Tests for git operations including branch creation and version commits
// ABOUTME: Validates version updates via ecosystem adapters and commit message formatting

import { test } from 'node:test';
import assert from 'node:assert';
import {
  createReleaseBranch,
  updatePackageVersions,
  commitAndPush,
} from './git.js';
import { simpleGit, SimpleGit } from 'simple-git';
import { mkdtemp, writeFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';
import { JavaScriptAdapter } from './ecosystems/javascript.js';
import type { WorkspaceInfo } from './workspace.js';

async function setupGitRepo(): Promise<string> {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-git-'));
  const git: SimpleGit = simpleGit(tmpDir);

  await git.init();
  await git.addConfig('user.name', 'Test User');
  await git.addConfig('user.email', 'test@example.com');

  // Create root package.json
  await writeFile(
    join(tmpDir, 'package.json'),
    JSON.stringify({ name: 'root', version: '1.0.0' }, null, 2)
  );
  await git.add('package.json');
  await git.commit('chore: initial commit');

  // Create workspace packages
  await mkdir(join(tmpDir, 'packages', 'pkg-a'), { recursive: true });
  await writeFile(
    join(tmpDir, 'packages', 'pkg-a', 'package.json'),
    JSON.stringify({ name: 'pkg-a', version: '1.0.0' }, null, 2)
  );

  await mkdir(join(tmpDir, 'packages', 'pkg-b'), { recursive: true });
  await writeFile(
    join(tmpDir, 'packages', 'pkg-b', 'package.json'),
    JSON.stringify({ name: 'pkg-b', version: '1.0.0' }, null, 2)
  );

  await git.add('.');
  await git.commit('chore: add packages');

  return tmpDir;
}

test('createReleaseBranch creates branch with current date', async () => {
  const tmpDir = await setupGitRepo();

  try {
    const git: SimpleGit = simpleGit(tmpDir);

    const releaseBranch = await createReleaseBranch(tmpDir);

    // Should be a new branch
    assert.strictEqual(releaseBranch.isNew, true);

    // Branch name should match release/YYYY-MM-DD format
    assert.ok(releaseBranch.name.match(/^release\/\d{4}-\d{2}-\d{2}$/));

    // Branch should exist
    const branches = await git.branchLocal();
    assert.ok(branches.all.includes(releaseBranch.name));

    // Should be on the release branch
    const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']);
    assert.strictEqual(currentBranch.trim(), releaseBranch.name);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('updatePackageVersions updates all package.json files', async () => {
  const tmpDir = await setupGitRepo();

  try {
    const jsAdapter = new JavaScriptAdapter();
    const workspace: WorkspaceInfo = {
      rootVersion: '1.0.0',
      rootPath: tmpDir,
      packages: [
        { name: 'pkg-a', version: '1.0.0', path: join(tmpDir, 'packages', 'pkg-a'), ecosystem: 'javascript' },
        { name: 'pkg-b', version: '1.0.0', path: join(tmpDir, 'packages', 'pkg-b'), ecosystem: 'javascript' },
      ],
      detectedEcosystems: ['javascript'],
      adapters: [jsAdapter],
    };

    await updatePackageVersions(workspace, '2.0.0');

    // Check root package.json
    const rootPkg = JSON.parse(
      await readFile(join(tmpDir, 'package.json'), 'utf-8')
    );
    assert.strictEqual(rootPkg.version, '2.0.0');

    // Check workspace packages
    const pkgA = JSON.parse(
      await readFile(join(tmpDir, 'packages', 'pkg-a', 'package.json'), 'utf-8')
    );
    assert.strictEqual(pkgA.version, '2.0.0');

    const pkgB = JSON.parse(
      await readFile(join(tmpDir, 'packages', 'pkg-b', 'package.json'), 'utf-8')
    );
    assert.strictEqual(pkgB.version, '2.0.0');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('commitAndPush creates commit with correct message', async () => {
  const tmpDir = await setupGitRepo();

  try {
    const git: SimpleGit = simpleGit(tmpDir);

    // Make a change
    await writeFile(join(tmpDir, 'test.txt'), 'test');
    await git.add('.');

    await commitAndPush(tmpDir, '2.0.0', false);

    const log = await git.log({ maxCount: 1 });
    assert.strictEqual(log.latest?.message, 'release: 2.0.0');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('commitAndPush auto-configures git in GitHub Actions', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-git-'));
  const git: SimpleGit = simpleGit(tmpDir);

  // Save original env
  const originalGithubActions = process.env.GITHUB_ACTIONS;

  try {
    // Initialize git without user config
    await git.init();

    // Set GITHUB_ACTIONS env
    process.env.GITHUB_ACTIONS = 'true';

    // Create initial file
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'test', version: '1.0.0' })
    );

    // Should auto-configure and commit successfully without any user config set
    await commitAndPush(tmpDir, '2.0.0', false);

    const log = await git.log({ maxCount: 1 });
    assert.strictEqual(log.latest?.message, 'release: 2.0.0');
    assert.strictEqual(log.latest?.author_name, 'github-actions[bot]');
  } finally {
    // Restore original env
    if (originalGithubActions === undefined) {
      delete process.env.GITHUB_ACTIONS;
    } else {
      process.env.GITHUB_ACTIONS = originalGithubActions;
    }
    rmSync(tmpDir, { recursive: true, force: true });
  }
});
