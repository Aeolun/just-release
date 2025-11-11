// ABOUTME: Tests for git operations including branch creation and version commits
// ABOUTME: Validates package.json version updates and commit message formatting

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

    const branchName = await createReleaseBranch(tmpDir);

    // Branch name should match release/YYYY-MM-DD format
    assert.ok(branchName.match(/^release\/\d{4}-\d{2}-\d{2}$/));

    // Branch should exist
    const branches = await git.branchLocal();
    assert.ok(branches.all.includes(branchName));

    // Should be on the release branch
    const currentBranch = await git.revparse(['--abbrev-ref', 'HEAD']);
    assert.strictEqual(currentBranch.trim(), branchName);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('updatePackageVersions updates all package.json files', async () => {
  const tmpDir = await setupGitRepo();

  try {
    const packages = [
      { name: 'pkg-a', version: '1.0.0', path: join(tmpDir, 'packages', 'pkg-a') },
      { name: 'pkg-b', version: '1.0.0', path: join(tmpDir, 'packages', 'pkg-b') },
    ];

    await updatePackageVersions(tmpDir, '2.0.0', packages);

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
