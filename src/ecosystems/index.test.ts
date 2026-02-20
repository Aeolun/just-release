// ABOUTME: Tests for multi-ecosystem orchestrator
// ABOUTME: Validates package discovery and version updates across ecosystems

import { test } from 'node:test';
import assert from 'node:assert';
import { discoverAllPackages, updateAllVersions } from './index.js';
import { mkdtemp, writeFile, mkdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';

test('discoverAllPackages detects JavaScript repo', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-eco-'));
  try {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'my-app', version: '1.0.0' })
    );

    const result = await discoverAllPackages(tmpDir);

    assert.deepStrictEqual(result.detectedEcosystems, ['javascript']);
    assert.strictEqual(result.packages.length, 1);
    assert.strictEqual(result.packages[0].name, 'my-app');
    assert.strictEqual(result.packages[0].ecosystem, 'javascript');
    assert.strictEqual(result.adapters.length, 1);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('discoverAllPackages returns empty for repo with no ecosystem', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-eco-'));
  try {
    await writeFile(join(tmpDir, 'README.md'), '# Hello');

    const result = await discoverAllPackages(tmpDir);

    assert.deepStrictEqual(result.detectedEcosystems, []);
    assert.strictEqual(result.packages.length, 0);
    assert.strictEqual(result.adapters.length, 0);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('discoverAllPackages discovers JS workspace packages', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-eco-'));
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
    await mkdir(join(tmpDir, 'packages', 'pkg-b'), { recursive: true });
    await writeFile(
      join(tmpDir, 'packages', 'pkg-b', 'package.json'),
      JSON.stringify({ name: 'pkg-b', version: '1.0.0' })
    );

    const result = await discoverAllPackages(tmpDir);

    assert.strictEqual(result.packages.length, 2);
    const names = result.packages.map((p) => p.name).sort();
    assert.deepStrictEqual(names, ['pkg-a', 'pkg-b']);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('updateAllVersions delegates to adapters', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-eco-'));
  try {
    await writeFile(
      join(tmpDir, 'pnpm-workspace.yaml'),
      'packages:\n  - "packages/*"\n'
    );
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'root', version: '1.0.0' }, null, 2)
    );
    await mkdir(join(tmpDir, 'packages', 'pkg-a'), { recursive: true });
    await writeFile(
      join(tmpDir, 'packages', 'pkg-a', 'package.json'),
      JSON.stringify({ name: 'pkg-a', version: '1.0.0' }, null, 2)
    );

    const discovery = await discoverAllPackages(tmpDir);
    await updateAllVersions(
      tmpDir,
      '2.0.0',
      discovery.packages,
      discovery.adapters
    );

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

test('discoverAllPackages detects Rust repo', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-eco-'));
  try {
    await writeFile(
      join(tmpDir, 'Cargo.toml'),
      '[package]\nname = "my-crate"\nversion = "1.0.0"\n'
    );

    const result = await discoverAllPackages(tmpDir);

    assert.deepStrictEqual(result.detectedEcosystems, ['rust']);
    assert.strictEqual(result.packages.length, 1);
    assert.strictEqual(result.packages[0].name, 'my-crate');
    assert.strictEqual(result.packages[0].ecosystem, 'rust');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('discoverAllPackages detects Go repo', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-eco-'));
  try {
    await writeFile(
      join(tmpDir, 'go.mod'),
      'module github.com/user/repo\n\ngo 1.21\n'
    );

    const result = await discoverAllPackages(tmpDir);

    assert.deepStrictEqual(result.detectedEcosystems, ['go']);
    assert.strictEqual(result.packages.length, 1);
    assert.strictEqual(result.packages[0].name, 'github.com/user/repo');
    assert.strictEqual(result.packages[0].ecosystem, 'go');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('discoverAllPackages merges packages from mixed JS + Rust repo', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-eco-'));
  try {
    // JS package
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'my-js-app', version: '1.0.0' })
    );
    // Rust crate
    await writeFile(
      join(tmpDir, 'Cargo.toml'),
      '[package]\nname = "my-rust-lib"\nversion = "1.0.0"\n'
    );

    const result = await discoverAllPackages(tmpDir);

    assert.deepStrictEqual(result.detectedEcosystems, ['javascript', 'rust']);
    assert.strictEqual(result.packages.length, 2);
    assert.strictEqual(result.adapters.length, 2);

    const jsPackages = result.packages.filter((p) => p.ecosystem === 'javascript');
    const rustPackages = result.packages.filter((p) => p.ecosystem === 'rust');
    assert.strictEqual(jsPackages.length, 1);
    assert.strictEqual(rustPackages.length, 1);
    assert.strictEqual(jsPackages[0].name, 'my-js-app');
    assert.strictEqual(rustPackages[0].name, 'my-rust-lib');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('discoverAllPackages merges packages from mixed JS + Go repo', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-eco-'));
  try {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'my-js-app', version: '1.0.0' })
    );
    await writeFile(
      join(tmpDir, 'go.mod'),
      'module github.com/user/repo\n\ngo 1.21\n'
    );

    const result = await discoverAllPackages(tmpDir);

    assert.deepStrictEqual(result.detectedEcosystems, ['javascript', 'go']);
    assert.strictEqual(result.packages.length, 2);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('discoverAllPackages merges all three ecosystems', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-eco-'));
  try {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'my-js-app', version: '1.0.0' })
    );
    await writeFile(
      join(tmpDir, 'Cargo.toml'),
      '[package]\nname = "my-crate"\nversion = "1.0.0"\n'
    );
    await writeFile(
      join(tmpDir, 'go.mod'),
      'module github.com/user/repo\n\ngo 1.21\n'
    );

    const result = await discoverAllPackages(tmpDir);

    assert.deepStrictEqual(result.detectedEcosystems, [
      'javascript',
      'rust',
      'go',
    ]);
    assert.strictEqual(result.packages.length, 3);
    assert.strictEqual(result.adapters.length, 3);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('updateAllVersions updates JS and Rust but not Go', async () => {
  const tmpDir = await mkdtemp(join(tmpdir(), 'test-eco-'));
  try {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'my-js-app', version: '1.0.0' }, null, 2)
    );
    await writeFile(
      join(tmpDir, 'Cargo.toml'),
      '[package]\nname = "my-crate"\nversion = "1.0.0"\n'
    );
    const goModContent = 'module github.com/user/repo\n\ngo 1.21\n';
    await writeFile(join(tmpDir, 'go.mod'), goModContent);

    const discovery = await discoverAllPackages(tmpDir);
    await updateAllVersions(
      tmpDir,
      '5.0.0',
      discovery.packages,
      discovery.adapters
    );

    // JS updated
    const pkg = JSON.parse(
      await readFile(join(tmpDir, 'package.json'), 'utf-8')
    );
    assert.strictEqual(pkg.version, '5.0.0');

    // Rust updated
    const cargo = await readFile(join(tmpDir, 'Cargo.toml'), 'utf-8');
    assert.ok(cargo.includes('version = "5.0.0"'));

    // Go unchanged
    const goMod = await readFile(join(tmpDir, 'go.mod'), 'utf-8');
    assert.strictEqual(goMod, goModContent);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});
