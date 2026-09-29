import fs from 'node:fs';
import path from 'node:path';
import { CANDIDATE_DIRS, findAssetFiles } from './output-detector.js';

export const WORKSPACE_FILENAMES = [
  'workspace.yml',
  'workspace.yaml',
  'pnpm-workspace.yaml',
  'pnpm-workspace.yml',
  'lerna.json',
  'package.json'
];

/**
 * Parse package patterns from simple YAML content without external dependencies
 */
export function parseYamlPackages(content) {
  const patterns = [];
  if (!content || typeof content !== 'string') return patterns;

  // Handle inline array syntax: packages: ['apps/*', 'packages/*']
  const inlineMatch = content.match(/(?:packages|projects)\s*:\s*\[([^\]]+)\]/);
  if (inlineMatch) {
    return inlineMatch[1]
      .split(',')
      .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
      .filter(Boolean);
  }

  const lines = content.split('\n');
  let inSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    if (/^(?:packages|projects)\s*:/.test(trimmed)) {
      inSection = true;
      continue;
    }

    if (inSection) {
      const itemMatch = trimmed.match(/^-\s*['"]?([^'"]+?)['"]?\s*$/);
      if (itemMatch) {
        patterns.push(itemMatch[1].trim());
      } else if (!line.startsWith(' ') && !line.startsWith('\t')) {
        break;
      }
    }
  }

  return patterns;
}

/**
 * Detect workspace configuration file in the given root directory
 */
export function detectWorkspaceConfig(rootDir = process.cwd()) {
  for (const filename of WORKSPACE_FILENAMES) {
    const filePath = path.join(rootDir, filename);
    if (!fs.existsSync(filePath)) continue;

    try {
      if (filename.endsWith('.json')) {
        const json = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (filename === 'package.json') {
          if (json.workspaces) {
            const patterns = Array.isArray(json.workspaces)
              ? json.workspaces
              : (Array.isArray(json.workspaces.packages) ? json.workspaces.packages : []);
            if (patterns.length > 0) {
              return { configFile: filename, patterns };
            }
          }
        } else if (filename === 'lerna.json' && Array.isArray(json.packages)) {
          return { configFile: filename, patterns: json.packages };
        }
      } else {
        const content = fs.readFileSync(filePath, 'utf-8');
        const patterns = parseYamlPackages(content);
        if (patterns.length > 0) {
          return { configFile: filename, patterns };
        }
      }
    } catch {
      // Ignore parse errors on malformed files and continue
    }
  }

  return null;
}

/**
 * Resolve directory paths from workspace glob patterns
 */
export function resolveWorkspacePatterns(rootDir, patterns = []) {
  const matchedDirs = new Set();
  const inclusions = patterns.filter(p => !p.startsWith('!'));
  const exclusions = patterns.filter(p => p.startsWith('!')).map(p => p.slice(1).replace(/^\.\//, ''));

  for (const pattern of inclusions) {
    const cleanPattern = pattern.replace(/^\.\//, '').replace(/\/$/, '');

    if (cleanPattern.endsWith('/*')) {
      const parentDir = path.resolve(rootDir, cleanPattern.slice(0, -2));
      if (fs.existsSync(parentDir) && fs.statSync(parentDir).isDirectory()) {
        try {
          const entries = fs.readdirSync(parentDir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.isDirectory() && !entry.name.startsWith('.')) {
              matchedDirs.add(path.join(parentDir, entry.name));
            }
          }
        } catch {}
      }
    } else if (cleanPattern.endsWith('/**')) {
      const parentDir = path.resolve(rootDir, cleanPattern.slice(0, -3));
      if (fs.existsSync(parentDir) && fs.statSync(parentDir).isDirectory()) {
        const walk = (dir) => {
          try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
              if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                const subPath = path.join(dir, entry.name);
                matchedDirs.add(subPath);
                walk(subPath);
              }
            }
          } catch {}
        };
        walk(parentDir);
      }
    } else {
      const directPath = path.resolve(rootDir, cleanPattern);
      if (fs.existsSync(directPath) && fs.statSync(directPath).isDirectory()) {
        matchedDirs.add(directPath);
      }
    }
  }

  // Filter exclusions
  for (const exclusion of exclusions) {
    const cleanExcl = exclusion.replace(/\*+/g, '').replace(/\/$/, '');
    for (const dir of Array.from(matchedDirs)) {
      const rel = path.relative(rootDir, dir);
      if (rel.includes(cleanExcl)) {
        matchedDirs.delete(dir);
      }
    }
  }

  return Array.from(matchedDirs).sort();
}

/**
 * Detect individual project details inside a workspace folder
 */
export function inspectWorkspaceProject(projectDir, rootDir = process.cwd()) {
  const relPath = path.relative(rootDir, projectDir) || '.';
  let name = relPath;
  let hasBuildScript = false;

  const pkgJsonPath = path.join(projectDir, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf-8'));
      if (pkg.name) name = pkg.name;
      if (pkg.scripts && pkg.scripts.build) hasBuildScript = true;
    } catch {}
  }

  // Look for build output directory
  let outputDir = null;
  for (const candidate of CANDIDATE_DIRS) {
    const fullCand = path.resolve(projectDir, candidate);
    if (fs.existsSync(fullCand) && fs.statSync(fullCand).isDirectory()) {
      const files = findAssetFiles(fullCand);
      if (files.length > 0) {
        outputDir = fullCand;
        break;
      }
    }
  }

  return {
    name,
    path: relPath,
    fullPath: projectDir,
    outputDir,
    hasOutput: Boolean(outputDir),
    hasBuildScript
  };
}

/**
 * Discover all workspace projects in a root directory
 */
export function findWorkspace(rootDir = process.cwd()) {
  const config = detectWorkspaceConfig(rootDir);
  if (!config) {
    return {
      isWorkspace: false,
      configFile: null,
      projects: []
    };
  }

  const projectDirs = resolveWorkspacePatterns(rootDir, config.patterns);
  const projects = projectDirs.map(dir => inspectWorkspaceProject(dir, rootDir));

  return {
    isWorkspace: true,
    configFile: config.configFile,
    projects
  };
}
