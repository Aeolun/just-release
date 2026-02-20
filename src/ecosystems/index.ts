// ABOUTME: Multi-ecosystem orchestrator that discovers packages across all ecosystems
// ABOUTME: Runs all adapters and merges results into a unified package list

import type { EcosystemAdapter, EcosystemType, WorkspacePackage } from './types.js';
import { JavaScriptAdapter } from './javascript.js';
import { RustAdapter } from './rust.js';
import { GoAdapter } from './go.js';

const ALL_ADAPTERS: EcosystemAdapter[] = [
  new JavaScriptAdapter(),
  new RustAdapter(),
  new GoAdapter(),
];

export interface DiscoveryResult {
  packages: WorkspacePackage[];
  detectedEcosystems: EcosystemType[];
  adapters: EcosystemAdapter[];
}

export async function discoverAllPackages(
  rootPath: string
): Promise<DiscoveryResult> {
  const detectedEcosystems: EcosystemType[] = [];
  const activeAdapters: EcosystemAdapter[] = [];
  const allPackages: WorkspacePackage[] = [];

  for (const adapter of ALL_ADAPTERS) {
    if (await adapter.detect(rootPath)) {
      detectedEcosystems.push(adapter.type);
      activeAdapters.push(adapter);
      const packages = await adapter.discoverPackages(rootPath);
      allPackages.push(...packages);
    }
  }

  return {
    packages: allPackages,
    detectedEcosystems,
    adapters: activeAdapters,
  };
}

export async function updateAllVersions(
  rootPath: string,
  newVersion: string,
  packages: WorkspacePackage[],
  adapters: EcosystemAdapter[]
): Promise<void> {
  for (const adapter of adapters) {
    await adapter.updateVersions(rootPath, newVersion, packages);
  }
}
