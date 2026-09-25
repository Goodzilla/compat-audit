import fs from 'node:fs';
import path from 'node:path';

/**
 * Standard output directories commonly used by modern frontend bundlers
 */
export const CANDIDATE_DIRS = [
  'dist',
  'build',
  'build/client',
  '.svelte-kit/output/client',
  '.next/static',
  'out',
  'public'
];

/**
 * Auto-detect the most likely production bundle directory
 */
export function detectOutputDir(baseDir = process.cwd()) {
  // 1. Direct check in baseDir
  for (const candidate of CANDIDATE_DIRS) {
    const fullPath = path.resolve(baseDir, candidate);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
      const files = findAssetFiles(fullPath);
      if (files.length > 0) return fullPath;
    }
  }

  // 2. Monorepo workspace check (apps/* or packages/*)
  const workspaceFolders = ['apps', 'packages'];
  for (const ws of workspaceFolders) {
    const wsDir = path.resolve(baseDir, ws);
    if (fs.existsSync(wsDir) && fs.statSync(wsDir).isDirectory()) {
      try {
        const subdirs = fs.readdirSync(wsDir, { withFileTypes: true });
        for (const sub of subdirs) {
          if (sub.isDirectory()) {
            for (const candidate of CANDIDATE_DIRS) {
              const fullPath = path.resolve(wsDir, sub.name, candidate);
              if (fs.existsSync(fullPath) && fs.statSync(fullPath).isDirectory()) {
                const files = findAssetFiles(fullPath);
                if (files.length > 0) return fullPath;
              }
            }
          }
        }
      } catch {}
    }
  }

  return null;
}

export const IGNORED_DIRS = new Set([
  'node_modules',
  '.pnpm-store',
  '.git',
  '.cache',
  '.turbo'
]);

/**
 * Recursively find JS, CSS, and HTML assets in directory
 */
export function findAssetFiles(dir) {
  const assets = [];
  if (!fs.existsSync(dir)) return assets;

  function walk(current) {
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (IGNORED_DIRS.has(entry.name)) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (['.js', '.mjs', '.cjs', '.css', '.html'].includes(ext)) {
          assets.push(full);
        }
      }
    }
  }

  walk(dir);
  return assets;
}
