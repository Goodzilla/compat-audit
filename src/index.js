import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { CompatDatabase, TARGET_BROWSERS, getBaselineSupport } from './data/compat-db.js';
import { JsScanner } from './scanners/js.js';
import { CssScanner } from './scanners/css.js';
import { HtmlScanner } from './scanners/html.js';
import { detectOutputDir, findAssetFiles } from './adapters/output-detector.js';
import { inspectProjectConfig, resolveDeclaredTargets, compareIntentVsReality } from './adapters/bundlers.js';
import { scoreIssue } from './scoring/effort.js';
import { initSkills } from './commands/init.js';

export { CompatDatabase, TARGET_BROWSERS, initSkills };

/**
 * Detect package manager based on lockfiles
 */
export function detectPackageManager(rootDir = process.cwd()) {
  if (fs.existsSync(path.join(rootDir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(rootDir, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(rootDir, 'bun.lockb')) || fs.existsSync(path.join(rootDir, 'bun.lock'))) return 'bun';
  return 'npm';
}

/**
 * Run comprehensive compatibility audit on a directory or auto-detected build output
 */
export async function auditBundle(options = {}) {
  const rootDir = options.cwd || process.cwd();
  let targetDir = options.dir ? path.resolve(rootDir, options.dir) : detectOutputDir(rootDir);

  // If build requested and output directory is missing or empty, auto-build
  if (options.build && (!targetDir || !fs.existsSync(targetDir) || findAssetFiles(targetDir).length === 0)) {
    const pm = detectPackageManager(rootDir);
    try {
      console.log(`Auto-building production assets with ${pm}...`);
      execSync(`${pm} run build`, { cwd: rootDir, stdio: 'inherit' });
      targetDir = options.dir ? path.resolve(rootDir, options.dir) : detectOutputDir(rootDir);
    } catch (err) {
      throw new Error(`Build failed (${pm} run build): ${err.message}`);
    }
  }

  if (!targetDir || !fs.existsSync(targetDir)) {
    throw new Error(
      `No build output directory found. Please specify a directory (e.g. compat-audit dist/) or run your build first (or pass --build).`
    );
  }

  const compatDb = new CompatDatabase();
  const jsScanner = new JsScanner(compatDb);
  const cssScanner = new CssScanner(compatDb);
  const htmlScanner = new HtmlScanner(compatDb);

  const files = findAssetFiles(targetDir);
  const jsFiles = files.filter(f => f.endsWith('.js') || f.endsWith('.mjs'));
  const cssFiles = files.filter(f => f.endsWith('.css'));
  const htmlFiles = files.filter(f => f.endsWith('.html'));

  const findingsMap = new Map();

  // Scan JS files
  for (const file of jsFiles) {
    try {
      const code = fs.readFileSync(file, 'utf-8');
      const relPath = path.relative(rootDir, file);
      const results = jsScanner.scan(code, relPath);
      for (const res of results) {
        if (!findingsMap.has(res.featureKey)) {
          findingsMap.set(res.featureKey, res);
        }
      }
    } catch {}
  }

  // Scan CSS files
  for (const file of cssFiles) {
    try {
      const code = fs.readFileSync(file, 'utf-8');
      const relPath = path.relative(rootDir, file);
      const results = cssScanner.scan(code, relPath);
      for (const res of results) {
        if (!findingsMap.has(res.featureKey)) {
          findingsMap.set(res.featureKey, res);
        }
      }
    } catch {}
  }

  // Scan HTML files
  for (const file of htmlFiles) {
    try {
      const code = fs.readFileSync(file, 'utf-8');
      const relPath = path.relative(rootDir, file);
      const results = htmlScanner.scan(code, relPath);
      for (const res of results) {
        if (!findingsMap.has(res.featureKey)) {
          findingsMap.set(res.featureKey, res);
        }
      }
    } catch {}
  }

  const allFindings = Array.from(findingsMap.values());

  // Bundler Intent vs Reality
  const projectConfig = inspectProjectConfig(rootDir);
  const declaredTargets = resolveDeclaredTargets(projectConfig);

  // Baseline standard floor fallback (e.g. ES2015)
  const baselineKey = (projectConfig.target && typeof projectConfig.target === 'string')
    ? projectConfig.target.toLowerCase()
    : 'es2015';
  const baselineSupport = getBaselineSupport(baselineKey);

  // Compute Minimum Supported Version (Browser Floor)
  const browserFloor = {};
  for (const b of TARGET_BROWSERS) {
    let maxVer = null;
    for (const item of allFindings) {
      const ver = item.support ? item.support[b.key] : null;
      if (ver !== null && (maxVer === null || ver > maxVer)) {
        maxVer = ver;
      }
    }
    // Default to realistic baseline floor if no higher modern features found
    browserFloor[b.key] = maxVer !== null ? maxVer : (baselineSupport[b.key] || 1);
  }

  // Calculate estimated global coverage %
  const coverage = compatDb.calculateCoverage(browserFloor);

  // Score all issues
  const scoredIssues = allFindings.map(item =>
    scoreIssue(item.featureKey, item.name, item.category, browserFloor, null)
  );

  // Group into Quick Wins (Effort 1 & 2) vs Structural Blockers (Effort 3 & 4)
  const quickWins = scoredIssues
    .filter(i => i.effort <= 2)
    .sort((a, b) => a.effort - b.effort);

  const structuralBlockers = scoredIssues
    .filter(i => i.effort > 2)
    .sort((a, b) => a.effort - b.effort);

  const diagnostics = compareIntentVsReality(projectConfig, allFindings);

  // Build Browser Compatibility Summary
  const browserSummary = TARGET_BROWSERS.map(b => {
    const minVer = browserFloor[b.key];
    const declared = declaredTargets.browsers[b.key] || { targetVersion: null, label: 'ES2015' };
    const targetVer = declared.targetVersion;

    let status = 'compliant';
    let statusLabel = '';
    let headroom = 0;
    let gap = 0;

    if (targetVer !== null && minVer > targetVer) {
      status = 'gap';
      gap = Math.round((minVer - targetVer) * 10) / 10;
      statusLabel = `⚠️ Compatibility Gap (Requires v${minVer}+, target v${targetVer}+)`;
    } else if (targetVer !== null && targetVer > minVer) {
      headroom = Math.round((targetVer - minVer) * 10) / 10;
      statusLabel = `✅ Compliant (+${headroom} versions headroom, down to v${minVer}+)`;
    } else {
      statusLabel = `✅ Compliant (Supported down to v${minVer}+)`;
    }

    return {
      key: b.key,
      browser: b.name,
      declaredTarget: declared.label,
      targetVersion: targetVer,
      minVersion: minVer,
      minVersionStr: `${b.name} ${minVer}+`,
      status,
      statusLabel,
      headroom,
      gap
    };
  });

  const hasGaps = browserSummary.some(s => s.status === 'gap') || quickWins.length > 0;
  const verdict = hasGaps ? 'COMPATIBILITY GAP DETECTED' : 'COMPLIANT';

  // Calculate target coverage and audience loss
  const targetCoverage = compatDb.calculateCoverage(
    Object.fromEntries(TARGET_BROWSERS.map(b => [b.key, declaredTargets.browsers[b.key]?.targetVersion || 1]))
  );
  const audienceLoss = Math.max(0, Math.round((targetCoverage - coverage) * 10) / 10);

  return {
    targetDir: path.relative(rootDir, targetDir) || targetDir,
    totalFiles: files.length,
    totalJsFiles: jsFiles.length,
    totalCssFiles: cssFiles.length,
    totalHtmlFiles: htmlFiles.length,
    verdict,
    hasGaps,
    browserFloor,
    browserSummary,
    coverage,
    audienceLoss,
    quickWins,
    structuralBlockers,
    diagnostics,
    projectConfig,
    declaredTargets,
    allFindings
  };
}
