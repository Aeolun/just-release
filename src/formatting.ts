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

export function generatePRSummary(commits: CommitInfo[]): string {
  return commits
    .map((c) => {
      // Use subject if available, otherwise fall back to rawMessage (first line of commit)
      const description = c.subject ?? c.rawMessage;
      let summary = `- ${c.hash}: ${getCommitPrefix(c)}${description}`;

      // Include body if present
      if (c.body && c.body.trim()) {
        // Indent the body for better readability (blank line before body)
        const indentedBody = c.body
          .split('\n')
          .map((line) => `  ${line}`)
          .join('\n');
        summary += `\n\n${indentedBody}`;
      }

      return summary;
    })
    .join('\n\n');
}
