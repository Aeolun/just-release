// ABOUTME: Tests for Go ecosystem adapter
// ABOUTME: Validates go.mod/go.work detection, module discovery, and no-op version updates

import { test } from 'node:test';
import assert from 'node:assert';
import { GoAdapter } from './go.js';
import { mkdtemp, writeFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';

const adapter = new GoAdapter();

test('detect returns true when go.mod exists', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-go-'));
  try {
    await writeFile(
      join(tmpDir, 'go.mod'),
      'module github.com/user/repo\n\ngo 1.21\n'
    );
    assert.strictEqual(await adapter.detect(tmpDir), true);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('detect returns false when no go.mod', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-go-'));
  try {
    assert.strictEqual(await adapter.detect(tmpDir), false);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('discoverPackages finds single module', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-go-'));
  try {
    await writeFile(
      join(tmpDir, 'go.mod'),
      'module github.com/user/repo\n\ngo 1.21\n'
    );

    const packages = await adapter.discoverPackages(tmpDir);

    assert.strictEqual(packages.length, 1);
    assert.strictEqual(packages[0].name, 'github.com/user/repo');
    assert.strictEqual(packages[0].version, '0.0.0');
    assert.strictEqual(packages[0].ecosystem, 'go');
    assert.strictEqual(packages[0].path, tmpDir);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('discoverPackages finds modules from go.work block syntax', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-go-'));
  try {
    await writeFile(
      join(tmpDir, 'go.work'),
      [
        'go 1.21',
        '',
        'use (',
        '    ./pkg1',
        '    ./pkg2',
        ')',
        '',
      ].join('\n')
    );
    await writeFile(
      join(tmpDir, 'go.mod'),
      'module github.com/user/repo\n\ngo 1.21\n'
    );

    await mkdir(join(tmpDir, 'pkg1'), { recursive: true });
    await writeFile(
      join(tmpDir, 'pkg1', 'go.mod'),
      'module github.com/user/repo/pkg1\n\ngo 1.21\n'
    );
    await mkdir(join(tmpDir, 'pkg2'), { recursive: true });
    await writeFile(
      join(tmpDir, 'pkg2', 'go.mod'),
      'module github.com/user/repo/pkg2\n\ngo 1.21\n'
    );

    const packages = await adapter.discoverPackages(tmpDir);

    assert.strictEqual(packages.length, 2);
    const names = packages.map((p) => p.name).sort();
    assert.deepStrictEqual(names, [
      'github.com/user/repo/pkg1',
      'github.com/user/repo/pkg2',
    ]);
    assert.ok(packages.every((p) => p.ecosystem === 'go'));
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('discoverPackages finds modules from go.work single-line syntax', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-go-'));
  try {
    await writeFile(
      join(tmpDir, 'go.work'),
      'go 1.21\n\nuse ./mymod\n'
    );
    await writeFile(
      join(tmpDir, 'go.mod'),
      'module github.com/user/repo\n\ngo 1.21\n'
    );
    await mkdir(join(tmpDir, 'mymod'), { recursive: true });
    await writeFile(
      join(tmpDir, 'mymod', 'go.mod'),
      'module github.com/user/repo/mymod\n\ngo 1.21\n'
    );

    const packages = await adapter.discoverPackages(tmpDir);

    assert.strictEqual(packages.length, 1);
    assert.strictEqual(packages[0].name, 'github.com/user/repo/mymod');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('discoverPackages skips go.work entries without go.mod', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-go-'));
  try {
    await writeFile(
      join(tmpDir, 'go.work'),
      'go 1.21\n\nuse (\n    ./exists\n    ./missing\n)\n'
    );
    await writeFile(
      join(tmpDir, 'go.mod'),
      'module github.com/user/repo\n\ngo 1.21\n'
    );
    await mkdir(join(tmpDir, 'exists'), { recursive: true });
    await writeFile(
      join(tmpDir, 'exists', 'go.mod'),
      'module github.com/user/repo/exists\n\ngo 1.21\n'
    );
    // ./missing has no go.mod

    const packages = await adapter.discoverPackages(tmpDir);

    assert.strictEqual(packages.length, 1);
    assert.strictEqual(packages[0].name, 'github.com/user/repo/exists');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('updateVersions is a no-op', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-go-'));
  try {
    const originalContent = 'module github.com/user/repo\n\ngo 1.21\n';
    await writeFile(join(tmpDir, 'go.mod'), originalContent);

    const packages = [
      {
        name: 'github.com/user/repo',
        version: '0.0.0',
        path: tmpDir,
        ecosystem: 'go' as const,
      },
    ];

    await adapter.updateVersions(tmpDir, '2.0.0', packages);

    // go.mod should be unchanged
    const content = await readFile(join(tmpDir, 'go.mod'), 'utf-8');
    assert.strictEqual(content, originalContent);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('isPrivate always returns false', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-go-'));
  try {
    await writeFile(
      join(tmpDir, 'go.mod'),
      'module github.com/user/repo\n\ngo 1.21\n'
    );
    assert.strictEqual(await adapter.isPrivate(tmpDir), false);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('checkPublishPrerequisites returns not ready (Go publishes via git tags)', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-go-'));
  try {
    const result = await adapter.checkPublishPrerequisites(tmpDir);
    assert.strictEqual(result.ready, false);
    assert.ok(result.reason?.includes('git tags'));
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('publishPackages returns empty array (no-op)', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-go-'));
  try {
    const packages = [
      {
        name: 'github.com/user/repo',
        version: '0.0.0',
        path: tmpDir,
        ecosystem: 'go' as const,
      },
    ];
    const results = await adapter.publishPackages(tmpDir, '1.0.0', packages);
    assert.deepStrictEqual(results, []);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('discoverPackages ignores comments in go.work', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-go-'));
  try {
    await writeFile(
      join(tmpDir, 'go.work'),
      [
        'go 1.21',
        '',
        'use (',
        '    // this is a comment',
        '    ./pkg1',
        ')',
        '',
      ].join('\n')
    );
    await writeFile(
      join(tmpDir, 'go.mod'),
      'module github.com/user/repo\n\ngo 1.21\n'
    );
    await mkdir(join(tmpDir, 'pkg1'), { recursive: true });
    await writeFile(
      join(tmpDir, 'pkg1', 'go.mod'),
      'module github.com/user/repo/pkg1\n\ngo 1.21\n'
    );

    const packages = await adapter.discoverPackages(tmpDir);

    assert.strictEqual(packages.length, 1);
    assert.strictEqual(packages[0].name, 'github.com/user/repo/pkg1');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});
