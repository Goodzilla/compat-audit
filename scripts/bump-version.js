import fs from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Determine SemVer bump type from Conventional Commit messages
 * @param {string} commits
 * @returns {'major' | 'minor' | 'patch'}
 */
export function determineBumpType(commits = '') {
  if (/BREAKING[- ]CHANGE/i.test(commits) || /^[a-z]+(\([a-z0-9_-]+\))?!:/im.test(commits)) {
    return 'major';
  }
  if (/^feat(\([a-z0-9_-]+\))?:/im.test(commits)) {
    return 'minor';
  }
  return 'patch';
}

/**
 * Compute the next SemVer version string
 * @param {string} baseVersion e.g. "1.0.0"
 * @param {'major' | 'minor' | 'patch'} bumpType
 * @returns {string}
 */
export function incrementVersion(baseVersion, bumpType) {
  const parts = (baseVersion || '1.0.0').split('.').map(Number);
  const major = parts[0] || 0;
  const minor = parts[1] || 0;
  const patch = parts[2] || 0;

  if (bumpType === 'major') return `${major + 1}.0.0`;
  if (bumpType === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

export function runBump(cwd = process.cwd()) {
  const pkgPath = path.resolve(cwd, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
  let baseVersion = pkg.version;

  // 1. Check current published version on npm registry
  try {
    const published = execSync(`npm view ${pkg.name} version 2>/dev/null`, { encoding: 'utf-8' }).trim();
    if (published && /^\d+\.\d+\.\d+$/.test(published)) {
      baseVersion = published;
    }
  } catch {}

  // 2. Read git commit messages since last tag
  let commits = '';
  try {
    let lastTag = '';
    try {
      lastTag = execSync('git describe --tags --abbrev=0 2>/dev/null', { encoding: 'utf-8', cwd }).trim();
    } catch {}

    const range = lastTag ? `${lastTag}..HEAD` : 'HEAD~1..HEAD';
    commits = execSync(`git log ${range} --format="%B" 2>/dev/null`, { encoding: 'utf-8', cwd });
  } catch {
    try {
      commits = execSync('git log -1 --format="%B"', { encoding: 'utf-8', cwd });
    } catch {
      commits = '';
    }
  }

  // 3. Determine bump type & calculate next version
  const bump = determineBumpType(commits);
  const nextVersion = incrementVersion(baseVersion, bump);

  // 4. Update package.json and package-lock.json
  pkg.version = nextVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

  try {
    const lockPath = path.resolve(cwd, 'package-lock.json');
    if (fs.existsSync(lockPath)) {
      const lock = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
      lock.version = nextVersion;
      if (lock.packages && lock.packages['']) {
        lock.packages[''].version = nextVersion;
      }
      fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2) + '\n');
    }
  } catch {}

  console.log(`Auto-semver bump: ${pkg.name}@${baseVersion} -> ${nextVersion} (${bump})`);

  // 5. Export outputs for GitHub Actions
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `version=${nextVersion}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `bump_type=${bump}\n`);
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `base_version=${baseVersion}\n`);
  }

  return { nextVersion, bump, baseVersion };
}

// Execute CLI when directly run
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  runBump();
}
