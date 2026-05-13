/**
 * Locate the Hermes checkout: env override wins, otherwise the embedded monorepo folder
 * {@code hermes-agent-private/} at the ShouldI repo root (git submodule / full-tree integration).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export type HermesTreeResolution = { source: 'env' | 'embedded'; root: string };

export function shouldiRepoRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  /** apps/api/{src|dist} → repo root */
  return path.resolve(here, '../../..');
}

export function defaultEmbeddedHermesRoot(): string {
  return path.join(shouldiRepoRoot(), 'hermes-agent-private');
}

export function isHermesTree(candidate: string): boolean {
  return fs.existsSync(path.join(candidate, 'run_agent.py'));
}

export function resolveHermesRepoRoot(): HermesTreeResolution | null {
  const raw = process.env.HERMES_ROOT?.trim() || process.env.SHOULDI_HERMES_ROOT?.trim();
  if (raw && isHermesTree(raw)) {
    return { source: 'env', root: path.resolve(raw) };
  }
  const embedded = defaultEmbeddedHermesRoot();
  if (isHermesTree(embedded)) {
    return { source: 'embedded', root: embedded };
  }
  return null;
}
