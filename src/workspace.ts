// ABOUTME: Detects monorepo workspace configuration from pnpm-workspace.yaml or package.json
// ABOUTME: Resolves workspace packages and validates root package.json version

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { glob } from 'glob';

export interface WorkspacePackage {
  name: string;
  version: string;
  path: string;
}

export interface WorkspaceInfo {
  rootVersion: string;
  rootPath: string;
  packages: WorkspacePackage[];
}

export async function detectWorkspace(rootPath: string): Promise<WorkspaceInfo> {
  // Read and validate root package.json
  const rootPackageJsonPath = join(rootPath, 'package.json');
  let rootPackageJson: any;

  try {
    const rootContent = await readFile(rootPackageJsonPath, 'utf-8');
    rootPackageJson = JSON.parse(rootContent);
  } catch (error) {
    throw new Error('root package.json not found');
  }

  if (!rootPackageJson.version) {
    throw new Error('root package.json must have a version field');
  }

  // Try to read pnpm-workspace.yaml first
  let workspacePatterns: string[] = [];

  try {
    const pnpmWorkspacePath = join(rootPath, 'pnpm-workspace.yaml');
    const pnpmContent = await readFile(pnpmWorkspacePath, 'utf-8');
    const pnpmConfig = parseYaml(pnpmContent);
    workspacePatterns = pnpmConfig.packages || [];
  } catch (error) {
    // If pnpm-workspace.yaml doesn't exist, try package.json workspaces
    if (rootPackageJson.workspaces) {
      workspacePatterns = Array.isArray(rootPackageJson.workspaces)
        ? rootPackageJson.workspaces
        : rootPackageJson.workspaces.packages || [];
    }
  }

  // Resolve workspace packages
  const packages: WorkspacePackage[] = [];

  for (const pattern of workspacePatterns) {
    const packagePaths = await glob(join(pattern, 'package.json'), {
      cwd: rootPath,
      absolute: true,
    });

    for (const packageJsonPath of packagePaths) {
      const packageContent = await readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageContent);
      const packagePath = packageJsonPath.replace(/\/package\.json$/, '');

      packages.push({
        name: packageJson.name,
        version: packageJson.version,
        path: packagePath,
      });
    }
  }

  return {
    rootVersion: rootPackageJson.version,
    rootPath,
    packages,
  };
}
