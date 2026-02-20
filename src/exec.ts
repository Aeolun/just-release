// ABOUTME: Shell execution utilities for running publish commands
// ABOUTME: Provides injectable exec function and binary detection for testing

import { execFile as nodeExecFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ExecFn, ExecResult } from './ecosystems/types.js';

const execFileAsync = promisify(nodeExecFile);

export const defaultExec: ExecFn = async (
  command: string,
  args: string[],
  options?: { cwd?: string; env?: Record<string, string> }
): Promise<ExecResult> => {
  const { stdout, stderr } = await execFileAsync(command, args, {
    cwd: options?.cwd,
    env: options?.env ? { ...process.env, ...options.env } : undefined,
  });
  return { stdout, stderr };
};

export async function binaryExists(name: string): Promise<boolean> {
  try {
    await execFileAsync(name, ['--version']);
    return true;
  } catch {
    return false;
  }
}
