// ABOUTME: Tests for CLI formatting functions
// ABOUTME: Validates commit prefix display and PR summary generation

import { test } from 'node:test';
import assert from 'node:assert';
import { getCommitPrefix, generatePRSummary } from './cli.js';
import { CommitInfo } from './commits.js';

test('getCommitPrefix returns correct emoji for conventional types', () => {
  const makeCommit = (type: string | null): CommitInfo => ({
    hash: 'abc123',
    type,
    scope: null,
    subject: 'test',
    body: null,
    breaking: false,
    packages: [],
    files: [],
    rawMessage: `${type}: test`,
  });

  assert.strictEqual(getCommitPrefix(makeCommit('feat')), '✨ ');
  assert.strictEqual(getCommitPrefix(makeCommit('fix')), '🐛 ');
  assert.strictEqual(getCommitPrefix(makeCommit('perf')), '⚡ ');
  assert.strictEqual(getCommitPrefix(makeCommit('test')), '✅ ');
  assert.strictEqual(getCommitPrefix(makeCommit('docs')), '📝 ');
  assert.strictEqual(getCommitPrefix(makeCommit('refactor')), '♻️ ');
  assert.strictEqual(getCommitPrefix(makeCommit('chore')), '🔧 ');
  assert.strictEqual(getCommitPrefix(makeCommit('style')), '💄 ');
  assert.strictEqual(getCommitPrefix(makeCommit('build')), '📦 ');
  assert.strictEqual(getCommitPrefix(makeCommit('ci')), '👷 ');
});

test('getCommitPrefix returns ❓ for non-conventional commits', () => {
  const commit: CommitInfo = {
    hash: 'abc123',
    type: null,
    scope: null,
    subject: null,
    body: null,
    breaking: false,
    packages: [],
    files: [],
    rawMessage: 'Update readme',
  };

  assert.strictEqual(getCommitPrefix(commit), '❓ ');
});

test('getCommitPrefix returns breaking prefix for breaking commits regardless of type', () => {
  const commit: CommitInfo = {
    hash: 'abc123',
    type: null,
    scope: null,
    subject: null,
    body: null,
    breaking: true,
    packages: [],
    files: [],
    rawMessage: 'Rewrite everything',
  };

  assert.strictEqual(getCommitPrefix(commit), '⚠️ BREAKING: ');
});

test('generatePRSummary uses subject for conventional commits', () => {
  const commits: CommitInfo[] = [
    {
      hash: 'abc123',
      type: 'feat',
      scope: null,
      subject: 'add new feature',
      body: null,
      breaking: false,
      packages: ['pkg-a'],
      files: ['packages/pkg-a/index.js'],
      rawMessage: 'feat: add new feature',
    },
  ];

  const summary = generatePRSummary(commits);

  assert.ok(summary.includes('abc123'));
  assert.ok(summary.includes('✨'));
  assert.ok(summary.includes('add new feature'));
});

test('generatePRSummary falls back to rawMessage for non-conventional commits', () => {
  const commits: CommitInfo[] = [
    {
      hash: 'def456',
      type: null,
      scope: null,
      subject: null,
      body: null,
      breaking: false,
      packages: ['pkg-a'],
      files: ['packages/pkg-a/index.js'],
      rawMessage: 'Update readme and fix typos',
    },
  ];

  const summary = generatePRSummary(commits);

  assert.ok(summary.includes('def456'));
  assert.ok(summary.includes('❓'));
  assert.ok(summary.includes('Update readme and fix typos'));
});

test('generatePRSummary handles mixed conventional and non-conventional commits', () => {
  const commits: CommitInfo[] = [
    {
      hash: 'abc123',
      type: 'feat',
      scope: null,
      subject: 'add feature',
      body: null,
      breaking: false,
      packages: ['pkg-a'],
      files: ['packages/pkg-a/index.js'],
      rawMessage: 'feat: add feature',
    },
    {
      hash: 'def456',
      type: null,
      scope: null,
      subject: null,
      body: null,
      breaking: false,
      packages: ['pkg-a'],
      files: ['README.md'],
      rawMessage: 'Just a plain commit',
    },
  ];

  const summary = generatePRSummary(commits);

  assert.ok(summary.includes('✨'));
  assert.ok(summary.includes('add feature'));
  assert.ok(summary.includes('❓'));
  assert.ok(summary.includes('Just a plain commit'));
});

test('generatePRSummary includes commit body when present', () => {
  const commits: CommitInfo[] = [
    {
      hash: 'abc123',
      type: null,
      scope: null,
      subject: null,
      body: 'This has more details\nabout the change',
      breaking: false,
      packages: ['pkg-a'],
      files: ['packages/pkg-a/index.js'],
      rawMessage: 'Update the thing',
    },
  ];

  const summary = generatePRSummary(commits);

  assert.ok(summary.includes('Update the thing'));
  assert.ok(summary.includes('This has more details'));
  assert.ok(summary.includes('about the change'));
});
