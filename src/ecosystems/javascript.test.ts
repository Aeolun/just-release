// ABOUTME: Tests for JavaScript ecosystem adapter
// ABOUTME: Validates package.json detection, workspace discovery, version updates, and publishing

import { test } from 'node:test';
import assert from 'node:assert';
import {
  JavaScriptAdapter,
  detectJsPackageManager,
  getPublishCommand,
} from './javascript.js';
import type { ExecFn } from './types.js';
import { mkdtemp, writeFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';

const adapter = new JavaScriptAdapter();

test('detect returns true when package.json exists', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-js-'));
  try {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'test', version: '1.0.0' })
    );
    assert.strictEqual(await adapter.detect(tmpDir), true);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('detect returns false when no package.json', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-js-'));
  try {
    assert.strictEqual(await adapter.detect(tmpDir), false);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('discoverPackages finds pnpm workspace packages', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-js-'));
  try {
    await writeFile(
      join(tmpDir, 'pnpm-workspace.yaml'),
      'packages:\n  - "packages/*"\n'
    );
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'root', version: '1.0.0' })
    );
    await mkdir(join(tmpDir, 'packages', 'pkg-a'), { recursive: true });
    await writeFile(
      join(tmpDir, 'packages', 'pkg-a', 'package.json'),
      JSON.stringify({ name: 'pkg-a', version: '1.0.0' })
    );

    const packages = await adapter.discoverPackages(tmpDir);

    assert.strictEqual(packages.length, 1);
    assert.strictEqual(packages[0].name, 'pkg-a');
    assert.strictEqual(packages[0].ecosystem, 'javascript');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('discoverPackages finds npm workspace packages', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-js-'));
  try {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'root',
        version: '2.0.0',
        workspaces: ['packages/*'],
      })
    );
    await mkdir(join(tmpDir, 'packages', 'pkg-b'), { recursive: true });
    await writeFile(
      join(tmpDir, 'packages', 'pkg-b', 'package.json'),
      JSON.stringify({ name: 'pkg-b', version: '2.0.0' })
    );

    const packages = await adapter.discoverPackages(tmpDir);

    assert.strictEqual(packages.length, 1);
    assert.strictEqual(packages[0].name, 'pkg-b');
    assert.strictEqual(packages[0].ecosystem, 'javascript');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('discoverPackages falls back to root package', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-js-'));
  try {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'my-package', version: '3.0.0' })
    );

    const packages = await adapter.discoverPackages(tmpDir);

    assert.strictEqual(packages.length, 1);
    assert.strictEqual(packages[0].name, 'my-package');
    assert.strictEqual(packages[0].path, tmpDir);
    assert.strictEqual(packages[0].ecosystem, 'javascript');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('updateVersions writes new version to all package.json files', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-js-'));
  try {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'root', version: '1.0.0' }, null, 2)
    );
    await mkdir(join(tmpDir, 'packages', 'pkg-a'), { recursive: true });
    await writeFile(
      join(tmpDir, 'packages', 'pkg-a', 'package.json'),
      JSON.stringify({ name: 'pkg-a', version: '1.0.0' }, null, 2)
    );

    const packages = [
      {
        name: 'pkg-a',
        version: '1.0.0',
        path: join(tmpDir, 'packages', 'pkg-a'),
        ecosystem: 'javascript' as const,
      },
    ];

    await adapter.updateVersions(tmpDir, '2.0.0', packages);

    const rootPkg = JSON.parse(
      await readFile(join(tmpDir, 'package.json'), 'utf-8')
    );
    assert.strictEqual(rootPkg.version, '2.0.0');

    const pkgA = JSON.parse(
      await readFile(
        join(tmpDir, 'packages', 'pkg-a', 'package.json'),
        'utf-8'
      )
    );
    assert.strictEqual(pkgA.version, '2.0.0');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('updateVersions ignores non-javascript packages', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-js-'));
  try {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'root', version: '1.0.0' }, null, 2)
    );

    const packages = [
      {
        name: 'my-crate',
        version: '1.0.0',
        path: join(tmpDir, 'crates', 'my-crate'),
        ecosystem: 'rust' as const,
      },
    ];

    // Should not throw even though the rust crate path doesn't exist
    await adapter.updateVersions(tmpDir, '2.0.0', packages);

    const rootPkg = JSON.parse(
      await readFile(join(tmpDir, 'package.json'), 'utf-8')
    );
    assert.strictEqual(rootPkg.version, '2.0.0');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

// --- isPrivate tests ---

test('isPrivate returns true for private packages', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-js-'));
  try {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'my-private-pkg', private: true })
    );
    assert.strictEqual(await adapter.isPrivate(tmpDir), true);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('isPrivate returns false for public packages', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-js-'));
  try {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'my-public-pkg', version: '1.0.0' })
    );
    assert.strictEqual(await adapter.isPrivate(tmpDir), false);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('isPrivate returns false when private is explicitly false', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-js-'));
  try {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'my-pkg', private: false })
    );
    assert.strictEqual(await adapter.isPrivate(tmpDir), false);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('isPrivate returns true when package.json is missing', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-js-'));
  try {
    assert.strictEqual(await adapter.isPrivate(tmpDir), true);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

// --- detectJsPackageManager tests ---

test('detectJsPackageManager detects pnpm from lockfile', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-js-'));
  try {
    await writeFile(join(tmpDir, 'pnpm-lock.yaml'), '');
    assert.strictEqual(await detectJsPackageManager(tmpDir), 'pnpm');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('detectJsPackageManager detects yarn from lockfile', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-js-'));
  try {
    await writeFile(join(tmpDir, 'yarn.lock'), '');
    assert.strictEqual(await detectJsPackageManager(tmpDir), 'yarn');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('detectJsPackageManager defaults to npm', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-js-'));
  try {
    assert.strictEqual(await detectJsPackageManager(tmpDir), 'npm');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('detectJsPackageManager prefers pnpm over yarn', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-js-'));
  try {
    await writeFile(join(tmpDir, 'pnpm-lock.yaml'), '');
    await writeFile(join(tmpDir, 'yarn.lock'), '');
    assert.strictEqual(await detectJsPackageManager(tmpDir), 'pnpm');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

// --- getPublishCommand tests ---

test('getPublishCommand returns correct pnpm command', () => {
  const { command, args } = getPublishCommand('pnpm');
  assert.strictEqual(command, 'pnpm');
  assert.deepStrictEqual(args, ['publish', '--no-git-checks', '--access', 'public']);
});

test('getPublishCommand returns correct yarn command', () => {
  const { command, args } = getPublishCommand('yarn');
  assert.strictEqual(command, 'yarn');
  assert.deepStrictEqual(args, ['npm', 'publish', '--access', 'public']);
});

test('getPublishCommand returns correct npm command', () => {
  const { command, args } = getPublishCommand('npm');
  assert.strictEqual(command, 'npm');
  assert.deepStrictEqual(args, ['publish', '--access', 'public']);
});

// --- publishPackages tests ---

test('publishPackages calls exec with correct command for each package', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-js-'));
  try {
    // Create pnpm lockfile so pnpm is detected
    await writeFile(join(tmpDir, 'pnpm-lock.yaml'), '');

    const calls: { command: string; args: string[]; cwd?: string }[] = [];
    const mockExec: ExecFn = async (command, args, options) => {
      calls.push({ command, args, cwd: options?.cwd });
      return { stdout: '', stderr: '' };
    };

    const packages = [
      { name: 'pkg-a', version: '1.0.0', path: join(tmpDir, 'a'), ecosystem: 'javascript' as const },
      { name: 'pkg-b', version: '1.0.0', path: join(tmpDir, 'b'), ecosystem: 'javascript' as const },
    ];

    const results = await adapter.publishPackages(tmpDir, '1.0.0', packages, mockExec);

    assert.strictEqual(results.length, 2);
    assert.ok(results.every((r) => r.success));
    assert.strictEqual(calls.length, 2);
    assert.strictEqual(calls[0].command, 'pnpm');
    assert.deepStrictEqual(calls[0].args, ['publish', '--no-git-checks', '--access', 'public']);
    assert.strictEqual(calls[0].cwd, join(tmpDir, 'a'));
    assert.strictEqual(calls[1].cwd, join(tmpDir, 'b'));
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('publishPackages filters out non-javascript packages', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-js-'));
  try {
    const calls: string[] = [];
    const mockExec: ExecFn = async (_command, _args, options) => {
      calls.push(options?.cwd || '');
      return { stdout: '', stderr: '' };
    };

    const packages = [
      { name: 'js-pkg', version: '1.0.0', path: join(tmpDir, 'js'), ecosystem: 'javascript' as const },
      { name: 'rs-pkg', version: '1.0.0', path: join(tmpDir, 'rs'), ecosystem: 'rust' as const },
    ];

    const results = await adapter.publishPackages(tmpDir, '1.0.0', packages, mockExec);

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].packageName, 'js-pkg');
    assert.strictEqual(calls.length, 1);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('publishPackages fails fast on error', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-js-'));
  try {
    let callCount = 0;
    const mockExec: ExecFn = async () => {
      callCount++;
      if (callCount === 1) {
        throw new Error('publish failed');
      }
      return { stdout: '', stderr: '' };
    };

    const packages = [
      { name: 'pkg-a', version: '1.0.0', path: join(tmpDir, 'a'), ecosystem: 'javascript' as const },
      { name: 'pkg-b', version: '1.0.0', path: join(tmpDir, 'b'), ecosystem: 'javascript' as const },
    ];

    const results = await adapter.publishPackages(tmpDir, '1.0.0', packages, mockExec);

    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].success, false);
    assert.ok(results[0].error?.includes('publish failed'));
    assert.strictEqual(callCount, 1); // Second package was NOT attempted
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('publishPackages uses npm command when no lockfile present', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-js-'));
  try {
    const calls: { command: string; args: string[] }[] = [];
    const mockExec: ExecFn = async (command, args) => {
      calls.push({ command, args });
      return { stdout: '', stderr: '' };
    };

    const packages = [
      { name: 'pkg-a', version: '1.0.0', path: join(tmpDir, 'a'), ecosystem: 'javascript' as const },
    ];

    await adapter.publishPackages(tmpDir, '1.0.0', packages, mockExec);

    assert.strictEqual(calls[0].command, 'npm');
    assert.deepStrictEqual(calls[0].args, ['publish', '--access', 'public']);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});
