// ABOUTME: Detects workspace configuration across JavaScript, Rust, and Go ecosystems
// ABOUTME: Resolves workspace packages and determines current version from git history

export type { WorkspacePackage, EcosystemType } from './ecosystems/types.js';
export type { EcosystemAdapter } from './ecosystems/types.js';
import type { WorkspacePackage, EcosystemType, EcosystemAdapter } from './ecosystems/types.js';
import { discoverAllPackages } from './ecosystems/index.js';
import { resolveCurrentVersion } from './version-source.js';

export interface WorkspaceInfo {
  rootVersion: string;
  rootPath: string;
  packages: WorkspacePackage[];
  detectedEcosystems: EcosystemType[];
  adapters: EcosystemAdapter[];
}

export async function detectWorkspace(rootPath: string): Promise<WorkspaceInfo> {
  const discovery = await discoverAllPackages(rootPath);

  if (discovery.packages.length === 0) {
    throw new Error(
      'No ecosystem detected. Expected at least one of: package.json, Cargo.toml, or go.mod'
    );
  }

  const rootVersion = await resolveCurrentVersion(rootPath);

  return {
    rootVersion,
    rootPath,
    packages: discovery.packages,
    detectedEcosystems: discovery.detectedEcosystems,
    adapters: discovery.adapters,
  };
}
