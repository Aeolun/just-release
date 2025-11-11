// ABOUTME: Tests for terminal color detection
// ABOUTME: Validates NO_COLOR, TERM=dumb, and TTY detection

import { test } from 'node:test';
import assert from 'node:assert';
import { supportsColor, getColors } from './colors.js';

test('supportsColor returns true for TTY with color support', () => {
  const env = {};
  const isTTY = true;

  assert.strictEqual(supportsColor(env, isTTY), true);
});

test('supportsColor returns false when NO_COLOR is set', () => {
  const env = { NO_COLOR: '1' };
  const isTTY = true;

  assert.strictEqual(supportsColor(env, isTTY), false);
});

test('supportsColor returns false when TERM=dumb', () => {
  const env = { TERM: 'dumb' };
  const isTTY = true;

  assert.strictEqual(supportsColor(env, isTTY), false);
});

test('supportsColor returns false when not a TTY', () => {
  const env = {};
  const isTTY = false;

  assert.strictEqual(supportsColor(env, isTTY), false);
});

test('supportsColor returns false when NO_COLOR set even with TTY', () => {
  const env = { NO_COLOR: '1', TERM: 'xterm-256color' };
  const isTTY = true;

  assert.strictEqual(supportsColor(env, isTTY), false);
});

test('getColors returns ANSI codes when color is supported', () => {
  const env = {};
  const isTTY = true;

  const colors = getColors(env, isTTY);

  assert.strictEqual(colors.blue, '\x1b[34m');
  assert.strictEqual(colors.reset, '\x1b[0m');
});

test('getColors returns empty strings when color is not supported', () => {
  const env = { NO_COLOR: '1' };
  const isTTY = true;

  const colors = getColors(env, isTTY);

  assert.strictEqual(colors.blue, '');
  assert.strictEqual(colors.reset, '');
});

test('getColors returns empty strings when not a TTY', () => {
  const env = {};
  const isTTY = false;

  const colors = getColors(env, isTTY);

  assert.strictEqual(colors.blue, '');
  assert.strictEqual(colors.reset, '');
});
