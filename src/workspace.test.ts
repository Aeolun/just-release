// ABOUTME: Tests for workspace detection and package resolution
// ABOUTME: Validates pnpm-workspace.yaml and package.json workspaces parsing

import { test } from 'node:test';
import assert from 'node:assert';
import { detectWorkspace } from './workspace.js';
import { mkdtemp, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';

test('detectWorkspace reads pnpm-workspace.yaml', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-'));

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

    const result = await detectWorkspace(tmpDir);

    assert.strictEqual(result.rootVersion, '1.0.0');
    assert.strictEqual(result.packages.length, 1);
    assert.strictEqual(result.packages[0].name, 'pkg-a');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('detectWorkspace reads package.json workspaces when no pnpm-workspace.yaml', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-'));

  try {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'root',
        version: '2.0.0',
        workspaces: ['packages/*']
      })
    );
    await mkdir(join(tmpDir, 'packages', 'pkg-b'), { recursive: true });
    await writeFile(
      join(tmpDir, 'packages', 'pkg-b', 'package.json'),
      JSON.stringify({ name: 'pkg-b', version: '2.0.0' })
    );

    const result = await detectWorkspace(tmpDir);

    assert.strictEqual(result.rootVersion, '2.0.0');
    assert.strictEqual(result.packages.length, 1);
    assert.strictEqual(result.packages[0].name, 'pkg-b');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('detectWorkspace throws when no root package.json', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-'));

  try {
    await assert.rejects(
      async () => await detectWorkspace(tmpDir),
      /root package\.json not found/i
    );
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('detectWorkspace throws when root package.json has no version', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-'));

  try {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'root' })
    );

    await assert.rejects(
      async () => await detectWorkspace(tmpDir),
      /root package\.json must have a version field/i
    );
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('detectWorkspace uses root package when no workspace config found', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-'));

  try {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'my-package', version: '3.0.0' })
    );

    const result = await detectWorkspace(tmpDir);

    assert.strictEqual(result.rootVersion, '3.0.0');
    assert.strictEqual(result.packages.length, 1);
    assert.strictEqual(result.packages[0].name, 'my-package');
    assert.strictEqual(result.packages[0].path, tmpDir);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});
