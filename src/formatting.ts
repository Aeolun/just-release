// ABOUTME: Formatting utilities for commit display in PRs and CLI output
// ABOUTME: Provides emoji prefixes and summary generation for commit lists

import { CommitInfo } from './commits.js';

export function getCommitPrefix(commit: CommitInfo): string {
  if (commit.breaking) return '⚠️ BREAKING: ';
  switch (commit.type) {
    case 'feat': return '✨ ';
    case 'fix': return '🐛 ';
    case 'perf': return '⚡ ';
    case 'test': return '✅ ';
    case 'docs': return '📝 ';
    case 'refactor': return '♻️ ';
    case 'chore': return '🔧 ';
    case 'style': return '💄 ';
    case 'build': return '📦 ';
    case 'ci': return '👷 ';
    default: return '❓ '; // Unknown/non-semantic commit type
  }
}

// Thresholds for PR body truncation (GitHub limit is 65,536 chars)
const FULL_DETAIL_LIMIT = 40_000;
const SUMMARY_ONLY_LIMIT = 60_000;

function formatCommitFull(c: CommitInfo): string {
  const description = c.subject ?? c.rawMessage;
  let summary = `- ${c.hash}: ${getCommitPrefix(c)}${description}`;

  if (c.body && c.body.trim()) {
    const indentedBody = c.body
      .split('\n')
      .map((line) => `  ${line}`)
      .join('\n');
    summary += `\n\n${indentedBody}`;
  }

  return summary;
}

function formatCommitSummary(c: CommitInfo): string {
  const description = c.subject ?? c.rawMessage;
  return `- ${c.hash}: ${getCommitPrefix(c)}${description}`;
}

function buildRemainderSuffix(remaining: CommitInfo[]): string {
  const counts = new Map<string, number>();
  for (const c of remaining) {
    const label = c.breaking ? 'breaking changes' : getTypeLabel(c.type);
    counts.set(label, (counts.get(label) || 0) + 1);
  }

  const parts = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => `${count} ${label}`);

  return `\n\n*...and ${remaining.length} more commits (${parts.join(', ')})*`;
}

function getTypeLabel(type: string | null): string {
  switch (type) {
    case 'feat': return 'features';
    case 'fix': return 'fixes';
    case 'perf': return 'performance';
    case 'test': return 'tests';
    case 'docs': return 'docs';
    case 'refactor': return 'refactors';
    case 'chore': return 'chores';
    case 'style': return 'style';
    case 'build': return 'build';
    case 'ci': return 'ci';
    default: return 'other';
  }
}

export function generatePRSummary(commits: CommitInfo[]): string {
  let result = '';
  let i = 0;

  // Phase 1: full detail (hash + prefix + subject + body)
  for (; i < commits.length; i++) {
    const entry = formatCommitFull(commits[i]);
    const addition = (result ? '\n\n' : '') + entry;

    if (result.length + addition.length > FULL_DETAIL_LIMIT) break;
    result += addition;
  }

  // Phase 2: summary only (hash + prefix + subject, no body)
  if (i < commits.length) {
    result += '\n\n---\n*Remaining commits shown without details:*\n';
  }
  for (; i < commits.length; i++) {
    const entry = formatCommitSummary(commits[i]);
    const addition = '\n' + entry;

    if (result.length + addition.length > SUMMARY_ONLY_LIMIT) break;
    result += addition;
  }

  // Phase 3: just counts for the rest
  if (i < commits.length) {
    result += buildRemainderSuffix(commits.slice(i));
  }

  return result;
}
