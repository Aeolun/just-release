// ABOUTME: Go ecosystem adapter for Go modules and workspaces
// ABOUTME: Detects go.mod, discovers modules via go.work, version updates are no-op

import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import type {
  EcosystemAdapter,
  WorkspacePackage,
  PublishPrerequisiteResult,
  PublishResult,
} from './types.js';

export class GoAdapter implements EcosystemAdapter {
  readonly type = 'go' as const;
  readonly displayName = 'Go';
  readonly manifestFileName = 'go.mod';

  async detect(rootPath: string): Promise<boolean> {
    try {
      await readFile(join(rootPath, 'go.mod'), 'utf-8');
      return true;
    } catch {
      return false;
    }
  }

  async discoverPackages(rootPath: string): Promise<WorkspacePackage[]> {
    const packages: WorkspacePackage[] = [];

    // Check for go.work (Go workspace, 1.18+)
    const moduleDirs = await this.parseGoWork(rootPath);

    if (moduleDirs.length > 0) {
      // Workspace mode: discover modules from go.work use directives
      for (const dir of moduleDirs) {
        const modulePath = resolve(rootPath, dir);
        const moduleName = await this.parseModuleName(modulePath);
        if (moduleName) {
          packages.push({
            name: moduleName,
            version: '0.0.0', // Go versions are purely git tags
            path: modulePath,
            ecosystem: 'go',
          });
        }
      }
    }

    // If no workspace or no modules found, treat root go.mod as single module
    if (packages.length === 0) {
      const moduleName = await this.parseModuleName(rootPath);
      if (moduleName) {
        packages.push({
          name: moduleName,
          version: '0.0.0',
          path: rootPath,
          ecosystem: 'go',
        });
      }
    }

    return packages;
  }

  async updateVersions(
    _rootPath: string,
    _newVersion: string,
    _packages: WorkspacePackage[]
  ): Promise<void> {
    // No-op: Go versions are purely git-tag-based.
    // GitHub releases already create vX.Y.Z tags.
  }

  async isPrivate(_packagePath: string): Promise<boolean> {
    // Go modules are never "private" in the npm/cargo sense.
    // Publishing = git tag, handled by GitHub release.
    return false;
  }

  async checkPublishPrerequisites(
    _rootPath: string
  ): Promise<PublishPrerequisiteResult> {
    // Go publishing is handled entirely by git tags via GitHub releases.
    return { ready: false, reason: 'Go modules are published via git tags (handled by GitHub release)' };
  }

  async publishPackages(
    _rootPath: string,
    _version: string,
    _packages: WorkspacePackage[]
  ): Promise<PublishResult[]> {
    // No-op: Go publishing is purely git-tag-based.
    return [];
  }

  /** Parse the module name from go.mod in the given directory. */
  private async parseModuleName(dir: string): Promise<string | null> {
    try {
      const content = await readFile(join(dir, 'go.mod'), 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('module ')) {
          return trimmed.slice('module '.length).trim();
        }
      }
    } catch {
      // go.mod doesn't exist or can't be read
    }
    return null;
  }

  /** Parse go.work for use directives, returning relative directory paths. */
  private async parseGoWork(rootPath: string): Promise<string[]> {
    let content: string;
    try {
      content = await readFile(join(rootPath, 'go.work'), 'utf-8');
    } catch {
      return [];
    }

    const dirs: string[] = [];
    let inUseBlock = false;

    for (const line of content.split('\n')) {
      const trimmed = line.trim();

      if (inUseBlock) {
        if (trimmed === ')') {
          inUseBlock = false;
          continue;
        }
        // Each line in the block is a directory path
        if (trimmed && !trimmed.startsWith('//')) {
          dirs.push(trimmed);
        }
        continue;
      }

      // Single-line use directive: use ./path
      if (trimmed.startsWith('use ') && !trimmed.includes('(')) {
        const dir = trimmed.slice('use '.length).trim();
        if (dir) {
          dirs.push(dir);
        }
        continue;
      }

      // Start of block: use (
      if (trimmed === 'use (' || trimmed.startsWith('use (')) {
        inUseBlock = true;
        // Handle "use ( ./dir )" on single line (unlikely but valid)
        const afterParen = trimmed.slice(trimmed.indexOf('(') + 1).trim();
        if (afterParen && afterParen !== ')') {
          if (afterParen.endsWith(')')) {
            dirs.push(afterParen.slice(0, -1).trim());
            inUseBlock = false;
          } else {
            dirs.push(afterParen);
          }
        }
      }
    }

    return dirs;
  }
}
