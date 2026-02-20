// ABOUTME: Tests for shell execution utilities
// ABOUTME: Validates defaultExec and binaryExists behavior

import { test } from 'node:test';
import assert from 'node:assert';
import { defaultExec, binaryExists } from './exec.js';

test('defaultExec runs a command and returns stdout', async () => {
  const result = await defaultExec('echo', ['hello']);
  assert.strictEqual(result.stdout.trim(), 'hello');
});

test('defaultExec respects cwd option', async () => {
  const result = await defaultExec('pwd', [], { cwd: '/tmp' });
  // /tmp may resolve to /private/tmp on macOS
  assert.ok(result.stdout.trim().endsWith('/tmp'));
});

test('defaultExec rejects on command failure', async () => {
  await assert.rejects(
    () => defaultExec('false', []),
    (err: Error) => err !== undefined
  );
});

test('binaryExists returns true for known binary', async () => {
  assert.strictEqual(await binaryExists('node'), true);
});

test('binaryExists returns false for nonexistent binary', async () => {
  assert.strictEqual(
    await binaryExists('definitely-not-a-real-binary-xyz'),
    false
  );
});
