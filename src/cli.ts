#!/usr/bin/env node
// ABOUTME: CLI entry point for mono-release tool
// ABOUTME: Orchestrates release workflow with dry-run and live modes

import { detectWorkspace } from './workspace.js';
import { analyzeCommits } from './commits.js';
import { calculateVersionBump } from './version.js';
import { generateChangelogs } from './changelog.js';
import {
  createReleaseBranch,
  updatePackageVersions,
  commitAndPush,
} from './git.js';
import { createOrUpdatePR } from './github.js';
import { getColors } from './colors.js';

const colors = getColors(process.env, process.stdout.isTTY);

async function main() {
  const isDryRun = process.env.CI !== '1';
  const cwd = process.cwd();

  console.log('🚀 mono-release\n');

  if (isDryRun) {
    console.log('🔍 Running in DRY-RUN mode (set CI=1 to execute)\n');
  } else {
    console.log('✅ Running in LIVE mode\n');
  }

  try {
    // Step 1: Detect workspace
    console.log('📦 Detecting workspace...');
    const workspace = await detectWorkspace(cwd);

    // Check if this is a single-package repo (root package only)
    const isSinglePackage =
      workspace.packages.length === 1 &&
      workspace.packages[0].path === workspace.rootPath;

    if (isSinglePackage) {
      console.log(`   No workspace configuration found`);
      console.log(`   Using root package at ${colors.blue}./package.json${colors.reset}`);
    } else {
      console.log(
        `   Found ${workspace.packages.length} package(s) in workspace`
      );
    }
    console.log(`   Current version: ${workspace.rootVersion}\n`);

    // Step 2: Analyze commits
    console.log('📝 Analyzing commits since last release...');
    const commits = await analyzeCommits(cwd, workspace.packages);

    if (commits.length === 0) {
      console.log(`   Found ${commits.length} commit(s) since last release`);
      console.log('\n✨ No new commits since last release. Nothing to do!');
      process.exit(0);
    }

    console.log(`   Found ${commits.length} commit(s) since last release:`);

    // Summarize commit types
    const commitCounts = new Map<string, number>();
    for (const commit of commits) {
      const type = commit.type || 'other';
      commitCounts.set(type, (commitCounts.get(type) || 0) + 1);
    }

    const sortedCounts = Array.from(commitCounts.entries())
      .sort((a, b) => b[1] - a[1]); // Sort by count descending

    for (const [type, count] of sortedCounts) {
      console.log(`     - ${count} ${type}`);
    }
    console.log();

    // Step 3: Calculate version bump
    console.log('🔢 Calculating version bump...');
    const versionBump = calculateVersionBump(
      workspace.rootVersion,
      commits
    );

    if (versionBump.bumpType === null) {
      console.log(
        '   No releasable changes (only chore/docs commits). Skipping release.'
      );
      process.exit(0);
    }

    console.log(
      `   Bump type: ${versionBump.bumpType} (${workspace.rootVersion} → ${versionBump.newVersion})\n`
    );

    if (isDryRun) {
      const packageJsonCount =
        workspace.packages.filter((p) => p.path !== workspace.rootPath).length + 1;
      console.log('🎯 Dry-run summary:');
      console.log(`   • Would create release branch`);
      console.log(
        `   • Would update ${packageJsonCount} package.json file(s)`
      );
      console.log(`   • Would generate changelogs for affected packages`);
      console.log(`   • Would commit changes with message: "release: ${versionBump.newVersion}"`);
      console.log(`   • Would push to remote and create/update PR`);
      console.log(
        '\n💡 Set CI=1 to execute these changes for real.\n'
      );
      process.exit(0);
    }

    // Step 4: Generate changelogs
    console.log('📄 Generating changelogs...');
    await generateChangelogs(
      versionBump.newVersion!,
      commits,
      workspace.packages
    );
    console.log('   Changelogs generated\n');

    // Step 5: Create release branch
    console.log('🌿 Creating release branch...');
    const branchName = await createReleaseBranch(cwd);
    console.log(`   Created branch: ${branchName}\n`);

    // Step 6: Update package versions
    console.log('📝 Updating package versions...');
    await updatePackageVersions(
      cwd,
      versionBump.newVersion!,
      workspace.packages
    );
    console.log('   Package versions updated\n');

    // Step 7: Commit and push
    console.log('💾 Committing and pushing changes...');
    await commitAndPush(cwd, versionBump.newVersion!, true);
    console.log('   Changes pushed to remote\n');

    // Step 8: Create or update PR
    console.log('🔗 Creating/updating pull request...');
    const githubToken = process.env.GITHUB_TOKEN;

    if (!githubToken) {
      console.error(
        '❌ GITHUB_TOKEN environment variable is required to create PR'
      );
      process.exit(1);
    }

    // Build changelog summary for PR body
    const changelogSummary = commits
      .filter((c) => c.type === 'feat' || c.type === 'fix' || c.breaking)
      .map((c) => {
        const prefix = c.breaking ? '⚠️ BREAKING: ' : c.type === 'feat' ? '✨ ' : '🐛 ';
        return `${prefix}${c.subject}`;
      })
      .join('\n');

    const prUrl = await createOrUpdatePR(
      cwd,
      branchName,
      versionBump.newVersion!,
      changelogSummary,
      githubToken
    );

    console.log(`   PR URL: ${prUrl}\n`);
    console.log('✅ Release process complete!\n');
  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

main();
