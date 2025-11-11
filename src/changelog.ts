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

export async function generateChangelogs(
  newVersion: string,
  commits: CommitInfo[],
  packages: WorkspacePackage[]
): Promise<void> {
  // Group commits by package
  const commitsByPackage = new Map<string, CommitInfo[]>();

  for (const commit of commits) {
    for (const packageName of commit.packages) {
      if (!commitsByPackage.has(packageName)) {
        commitsByPackage.set(packageName, []);
      }
      commitsByPackage.get(packageName)!.push(commit);
    }
  }

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
    const today = new Date().toISOString().split('T')[0];
    let versionSection = `## ${newVersion} (${today})\n\n`;

    // Group commits by type
    const breaking = packageCommits.filter((c) => c.breaking);
    const features = packageCommits.filter(
      (c) => c.type === 'feat' && !c.breaking
    );
    const fixes = packageCommits.filter((c) => c.type === 'fix');
    const perf = packageCommits.filter((c) => c.type === 'perf');

    // Add breaking changes section
    if (breaking.length > 0) {
      versionSection += '### BREAKING CHANGES\n\n';
      for (const commit of breaking) {
        versionSection += `- ${commit.subject}\n`;
      }
      versionSection += '\n';
    }

    // Add features section
    if (features.length > 0) {
      versionSection += '### Features\n\n';
      for (const commit of features) {
        versionSection += `- ${commit.subject}\n`;
      }
      versionSection += '\n';
    }

    // Add bug fixes section
    if (fixes.length > 0) {
      versionSection += '### Bug Fixes\n\n';
      for (const commit of fixes) {
        versionSection += `- ${commit.subject}\n`;
      }
      versionSection += '\n';
    }

    // Add performance section
    if (perf.length > 0) {
      versionSection += '### Performance Improvements\n\n';
      for (const commit of perf) {
        versionSection += `- ${commit.subject}\n`;
      }
      versionSection += '\n';
    }

    // Combine new and existing content
    const fullChangelog =
      '# Changelog\n\n' + versionSection + existingContent;

    await writeFile(changelogPath, fullChangelog, 'utf-8');
  }
}
