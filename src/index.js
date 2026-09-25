import fs from 'node:fs';
import path from 'node:path';
import { CompatDatabase, TARGET_BROWSERS } from './data/compat-db.js';
import { JsScanner } from './scanners/js.js';
import { CssScanner } from './scanners/css.js';
import { HtmlScanner } from './scanners/html.js';
import { detectOutputDir, findAssetFiles } from './adapters/output-detector.js';
import { inspectProjectConfig, compareIntentVsReality } from './adapters/bundlers.js';
import { scoreIssue } from './scoring/effort.js';
import { initSkills } from './commands/init.js';

export { CompatDatabase, TARGET_BROWSERS, initSkills };

/**
 * Run comprehensive compatibility audit on a directory or auto-detected build output
 */
export async function auditBundle(options = {}) {
  const rootDir = options.cwd || process.cwd();
  const targetDir = options.dir ? path.resolve(rootDir, options.dir) : detectOutputDir(rootDir);

  if (!targetDir || !fs.existsSync(targetDir)) {
    throw new Error(
      `No build output directory found. Please specify a directory (e.g. compat-audit dist/) or run your build first.`
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

  // Compute Effective Browser Floor (Maximum required version for each browser)
  const browserFloor = {};
  for (const b of TARGET_BROWSERS) {
    let maxVer = null;
    for (const item of allFindings) {
      const ver = item.support ? item.support[b.key] : null;
      if (ver !== null && (maxVer === null || ver > maxVer)) {
        maxVer = ver;
      }
    }
    browserFloor[b.key] = maxVer;
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

  // Bundler Intent vs Reality
  const projectConfig = inspectProjectConfig(rootDir);
  const diagnostics = compareIntentVsReality(projectConfig, allFindings);

  return {
    targetDir: path.relative(rootDir, targetDir) || targetDir,
    totalFiles: files.length,
    totalJsFiles: jsFiles.length,
    totalCssFiles: cssFiles.length,
    totalHtmlFiles: htmlFiles.length,
    browserFloor,
    coverage,
    quickWins,
    structuralBlockers,
    diagnostics,
    projectConfig,
    allFindings
  };
}
