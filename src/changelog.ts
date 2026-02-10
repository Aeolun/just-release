// ABOUTME: Generates changelog entries for workspace packages with changes
// ABOUTME: Creates markdown-formatted changelogs grouped by commit type

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CommitInfo } from './commits.js';
import { WorkspacePackage } from './workspace.js';

interface ChangelogEntry {
  type: string;
  subject: string;
  breaking: boolean;
}

// Helper to get display text for a commit (subject or rawMessage fallback)
function getCommitDisplayText(commit: CommitInfo): string {
  return commit.subject ?? commit.rawMessage;
}

export function generateChangelogSection(
  newVersion: string,
  commits: CommitInfo[]
): string {
  const today = new Date().toISOString().split('T')[0];
  let versionSection = `## ${newVersion} (${today})\n\n`;

  // Known commit types
  const knownTypes = new Set(['feat', 'fix', 'perf', 'test', 'docs', 'chore', 'refactor', 'style', 'build', 'ci']);

  // Group commits by type
  const breaking = commits.filter((c) => c.breaking);
  const features = commits.filter(
    (c) => c.type === 'feat' && !c.breaking
  );
  const fixes = commits.filter((c) => c.type === 'fix');
  const perf = commits.filter((c) => c.type === 'perf');
  const tests = commits.filter((c) => c.type === 'test');
  const docs = commits.filter((c) => c.type === 'docs');
  const chores = commits.filter((c) => c.type === 'chore');
  const refactors = commits.filter((c) => c.type === 'refactor');
  const styles = commits.filter((c) => c.type === 'style');
  const builds = commits.filter((c) => c.type === 'build');
  const ci = commits.filter((c) => c.type === 'ci');
  const other = commits.filter((c) => !c.breaking && (c.type === null || !knownTypes.has(c.type)));

  // Add breaking changes section
  if (breaking.length > 0) {
    versionSection += '### BREAKING CHANGES\n\n';
    for (const commit of breaking) {
      versionSection += `- ${getCommitDisplayText(commit)}\n`;
    }
    versionSection += '\n';
  }

  // Add features section
  if (features.length > 0) {
    versionSection += '### Features\n\n';
    for (const commit of features) {
      versionSection += `- ${getCommitDisplayText(commit)}\n`;
    }
    versionSection += '\n';
  }

  // Add bug fixes section
  if (fixes.length > 0) {
    versionSection += '### Bug Fixes\n\n';
    for (const commit of fixes) {
      versionSection += `- ${getCommitDisplayText(commit)}\n`;
    }
    versionSection += '\n';
  }

  // Add performance section
  if (perf.length > 0) {
    versionSection += '### Performance Improvements\n\n';
    for (const commit of perf) {
      versionSection += `- ${getCommitDisplayText(commit)}\n`;
    }
    versionSection += '\n';
  }

  // Add tests section
  if (tests.length > 0) {
    versionSection += '### Tests\n\n';
    for (const commit of tests) {
      versionSection += `- ${getCommitDisplayText(commit)}\n`;
    }
    versionSection += '\n';
  }

  // Add documentation section
  if (docs.length > 0) {
    versionSection += '### Documentation\n\n';
    for (const commit of docs) {
      versionSection += `- ${getCommitDisplayText(commit)}\n`;
    }
    versionSection += '\n';
  }

  // Add refactoring section
  if (refactors.length > 0) {
    versionSection += '### Refactoring\n\n';
    for (const commit of refactors) {
      versionSection += `- ${getCommitDisplayText(commit)}\n`;
    }
    versionSection += '\n';
  }

  // Add chores section
  if (chores.length > 0) {
    versionSection += '### Chores\n\n';
    for (const commit of chores) {
      versionSection += `- ${getCommitDisplayText(commit)}\n`;
    }
    versionSection += '\n';
  }

  // Add style section
  if (styles.length > 0) {
    versionSection += '### Styles\n\n';
    for (const commit of styles) {
      versionSection += `- ${getCommitDisplayText(commit)}\n`;
    }
    versionSection += '\n';
  }

  // Add build section
  if (builds.length > 0) {
    versionSection += '### Build\n\n';
    for (const commit of builds) {
      versionSection += `- ${getCommitDisplayText(commit)}\n`;
    }
    versionSection += '\n';
  }

  // Add CI section
  if (ci.length > 0) {
    versionSection += '### CI\n\n';
    for (const commit of ci) {
      versionSection += `- ${getCommitDisplayText(commit)}\n`;
    }
    versionSection += '\n';
  }

  // Add other/uncategorized commits section
  if (other.length > 0) {
    versionSection += '### Other\n\n';
    for (const commit of other) {
      versionSection += `- ${getCommitDisplayText(commit)}\n`;
    }
    versionSection += '\n';
  }

  return versionSection;
}

export function groupCommitsByPackage(
  commits: CommitInfo[]
): Map<string, CommitInfo[]> {
  const commitsByPackage = new Map<string, CommitInfo[]>();

  for (const commit of commits) {
    for (const packageName of commit.packages) {
      if (!commitsByPackage.has(packageName)) {
        commitsByPackage.set(packageName, []);
      }
      commitsByPackage.get(packageName)!.push(commit);
    }
  }

  return commitsByPackage;
}

export async function generateChangelogs(
  newVersion: string,
  commits: CommitInfo[],
  packages: WorkspacePackage[]
): Promise<void> {
  // Group commits by package
  const commitsByPackage = groupCommitsByPackage(commits);

  // Generate changelog for each package with changes
  for (const pkg of packages) {
    const packageCommits = commitsByPackage.get(pkg.name);

    // Skip packages with no changes
    if (!packageCommits || packageCommits.length === 0) {
      continue;
    }

    const changelogPath = join(pkg.path, 'CHANGELOG.md');

    // Read existing changelog if it exists
    let existingContent = '';
    try {
      existingContent = await readFile(changelogPath, 'utf-8');
      // Remove the header if it exists
      if (existingContent.startsWith('# Changelog\n\n')) {
        existingContent = existingContent.substring('# Changelog\n\n'.length);
      }
    } catch (error) {
      // File doesn't exist, that's okay
    }

    // Generate new version section
    const versionSection = generateChangelogSection(newVersion, packageCommits);

    // Combine new and existing content
    const fullChangelog =
      '# Changelog\n\n' + versionSection + existingContent;

    await writeFile(changelogPath, fullChangelog, 'utf-8');
  }
}
