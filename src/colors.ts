// ABOUTME: Detects terminal color support capabilities
// ABOUTME: Respects NO_COLOR standard and terminal type detection

export function supportsColor(env: NodeJS.ProcessEnv, isTTY: boolean): boolean {
  // Respect NO_COLOR standard: https://no-color.org/
  if (env.NO_COLOR) {
    return false;
  }

  // Dumb terminals don't support colors
  if (env.TERM === 'dumb') {
    return false;
  }

  // Only use colors in TTY (not when piped)
  if (!isTTY) {
    return false;
  }

  return true;
}

export function getColors(env: NodeJS.ProcessEnv, isTTY: boolean) {
  const hasColor = supportsColor(env, isTTY);

  return {
    blue: hasColor ? '\x1b[34m' : '',
    reset: hasColor ? '\x1b[0m' : '',
  };
}
