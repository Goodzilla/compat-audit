import fs from 'node:fs';
import path from 'node:path';
import { CompatDatabase, TARGET_BROWSERS, getBaselineSupport } from './data/compat-db.js';
import { JsScanner } from './scanners/js.js';
import { CssScanner } from './scanners/css.js';
import { HtmlScanner } from './scanners/html.js';
import { detectOutputDir, findAssetFiles } from './adapters/output-detector.js';
import { inspectProjectConfig, resolveDeclaredTargets, compareIntentVsReality } from './adapters/bundlers.js';
import { evaluateSeverity, normalizeThreshold, meetsThreshold, evaluateCiThreshold } from './scoring/severity.js';
import { initSkills } from './commands/init.js';
import { findWorkspace, inspectWorkspaceProject } from './adapters/workspace.js';
import { detectRuntimePolyfillsInVm } from './adapters/polyfills.js';

export {
  CompatDatabase,
  TARGET_BROWSERS,
  initSkills,
  findWorkspace,
  evaluateSeverity,
  normalizeThreshold,
  meetsThreshold,
  evaluateCiThreshold
};

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
 * Run compatibility audit on a single project directory
 */
export async function auditSingleProject(options = {}) {
  const rootDir = options.cwd || process.cwd();
  const pm = detectPackageManager(rootDir);

  let targetDir = options.dir ? path.resolve(rootDir, options.dir) : detectOutputDir(rootDir);

  // If build requested, unconditionally force fresh build to guarantee up-to-date assets
  if (options.build) {
    try {
      console.log(`Building fresh production assets with ${pm}...`);
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

  const compatDb = new CompatDatabase({ region: options.region });
  const jsScanner = new JsScanner(compatDb);
  const cssScanner = new CssScanner(compatDb);
  const htmlScanner = new HtmlScanner(compatDb);

  const files = findAssetFiles(targetDir);
  const jsFiles = files.filter(f => f.endsWith('.js') || f.endsWith('.mjs'));
  const cssFiles = files.filter(f => f.endsWith('.css'));
  const htmlFiles = files.filter(f => f.endsWith('.html'));

  const findingsMap = new Map();

  const addFindingToMap = (res) => {
    if (!findingsMap.has(res.featureKey)) {
      findingsMap.set(res.featureKey, {
        ...res,
        files: res.file ? [res.file] : []
      });
    } else {
      const existing = findingsMap.get(res.featureKey);
      if (res.file && !existing.files.includes(res.file)) {
        existing.files.push(res.file);
      }
    }
  };

  // --- Polyfill Detection via node:vm Runtime Sandbox ---
  const activePolyfills = new Map();

  for (const file of jsFiles) {
    try {
      const code = fs.readFileSync(file, 'utf-8');
      const relPath = path.relative(rootDir, file);
      const runtimeExtracted = detectRuntimePolyfillsInVm(code, relPath, compatDb);
      for (const [key, val] of runtimeExtracted) {
        activePolyfills.set(key, val);
      }
    } catch {}
  }

  // Build lookup Set of all polyfill identifiers and feature keys
  const bundlePolyfillKeys = new Set();
  for (const [key, val] of activePolyfills) {
    bundlePolyfillKeys.add(key);
    if (val.name) bundlePolyfillKeys.add(val.name);
    const shortName = key.split('.').pop();
    if (shortName) {
      bundlePolyfillKeys.add(shortName);
      bundlePolyfillKeys.add('prototype.' + shortName);
      bundlePolyfillKeys.add('api.' + shortName);
    }
  }

  // Scan JS files with active bundle-wide polyfills
  for (const file of jsFiles) {
    try {
      const code = fs.readFileSync(file, 'utf-8');
      const relPath = path.relative(rootDir, file);
      const results = jsScanner.scan(code, relPath, file, bundlePolyfillKeys);
      for (const res of results) {
        addFindingToMap(res);
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
        addFindingToMap(res);
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
        addFindingToMap(res);
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

  // Calculate estimated audience coverage % for the configured region
  const coverage = compatDb.calculateCoverage(browserFloor);

  // Score all issues with severity & impact breakdown
  const allScoredIssues = allFindings.map(item => {
    const scored = evaluateSeverity(item, declaredTargets, compatDb);
    const causesGap = TARGET_BROWSERS.some(b => {
      const declaredVer = declaredTargets.browsers[b.key]?.targetVersion;
      const featVer = item.support ? item.support[b.key] : null;
      return declaredVer !== null && declaredVer !== undefined && featVer !== null && featVer > declaredVer;
    });
    return {
      ...scored,
      causesGap
    };
  });

  // Filter issues: only gap-causing issues by default, or all if options.all
  const issues = (options.all ? allScoredIssues : allScoredIssues.filter(i => i.causesGap))
    .sort((a, b) => {
      if (b.severityMeta.rank !== a.severityMeta.rank) {
        return b.severityMeta.rank - a.severityMeta.rank;
      }
      if (b.audienceLoss !== a.audienceLoss) {
        return b.audienceLoss - a.audienceLoss;
      }
      return a.name.localeCompare(b.name);
    });

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
      statusLabel = `Compatibility Gap (Requires v${minVer}+, target v${targetVer}+)`;
    } else if (targetVer !== null && targetVer > minVer) {
      headroom = Math.round((targetVer - minVer) * 10) / 10;
      statusLabel = `Compliant (+${headroom} versions headroom, down to v${minVer}+)`;
    } else {
      statusLabel = `Compliant (Supported down to v${minVer}+)`;
    }

    const hasSpecificVer = targetVer !== null && targetVer !== undefined
      && !String(declared.label).includes(String(targetVer));
    const targetDisplay = hasSpecificVer
      ? `${declared.label} ~ v${targetVer}+`
      : declared.label;

    return {
      key: b.key,
      browser: b.name,
      platform: b.platform || 'desktop',
      declaredTarget: declared.label,
      targetVersion: targetVer,
      targetDisplay,
      minVersion: minVer,
      minVersionStr: `${b.name} ${minVer}+`,
      status,
      statusLabel,
      headroom,
      gap
    };
  });

  const hasGaps = browserSummary.some(s => s.status === 'gap');
  const verdict = hasGaps ? 'COMPATIBILITY GAP DETECTED' : 'COMPLIANT';

  // Calculate target coverage, measured coverage, and audience gap
  const targetCoverage = compatDb.calculateCoverage(
    Object.fromEntries(TARGET_BROWSERS.map(b => [b.key, declaredTargets.browsers[b.key]?.targetVersion || 1]))
  );
  const measuredCoverage = coverage;
  const audienceGap = Math.round((measuredCoverage - targetCoverage) * 10) / 10;
  const audienceLoss = Math.max(0, Math.round((targetCoverage - measuredCoverage) * 10) / 10);
  const regionLabel = compatDb.region === 'global' ? 'Global' : compatDb.region;

  const threshold = options.failOn || options.threshold || (options.ci ? 'BLOCKING' : null);
  const ciResult = evaluateCiThreshold(issues, threshold);
  const detectedPolyfills = Array.from(activePolyfills.values());

  return {
    projectName: options.projectName || null,
    projectPath: options.projectPath || null,
    targetDir: path.relative(rootDir, targetDir) || targetDir,
    totalFiles: files.length,
    totalJsFiles: jsFiles.length,
    totalCssFiles: cssFiles.length,
    totalHtmlFiles: htmlFiles.length,
    verdict,
    hasGaps,
    region: compatDb.region,
    regionLabel,
    browserFloor,
    browserSummary,
    coverage,
    measuredCoverage,
    targetCoverage,
    audienceGap,
    audienceLoss,
    issues,
    allIssues: allScoredIssues,
    detectedPolyfills,
    ciResult,
    diagnostics,
    projectConfig,
    declaredTargets,
    allFindings
  };
}

/**
 * Run comprehensive compatibility audit on a directory or auto-detected workspace/project
 */
export async function auditBundle(options = {}) {
  const rootDir = options.cwd || process.cwd();

  // If a directory is explicitly specified, audit that single target
  if (options.dir) {
    return auditSingleProject(options);
  }

  // Check if current directory is a monorepo workspace
  const ws = findWorkspace(rootDir);
  if (ws.isWorkspace && ws.projects.length > 0) {
    let targetProjects = ws.projects;

    // Filter by specific project if requested via options.project
    if (options.project) {
      targetProjects = ws.projects.filter(p =>
        p.name === options.project ||
        p.path === options.project ||
        p.path.endsWith(options.project) ||
        path.basename(p.path) === options.project
      );
      if (targetProjects.length === 0) {
        throw new Error(
          `Project "${options.project}" not found in workspace (${ws.configFile}). Available projects: ${ws.projects.map(p => p.name || p.path).join(', ')}`
        );
      }
    }

    const pm = detectPackageManager(rootDir);
    if (options.build) {
      console.log(`Building workspace projects with ${pm}...`);
      try {
        execSync(`${pm} run build`, { cwd: rootDir, stdio: 'inherit' });
      } catch (err) {
        throw new Error(`Workspace build failed (${pm} run build): ${err.message}`);
      }
      targetProjects = targetProjects.map(p => inspectWorkspaceProject(p.fullPath, rootDir));
    }

    const projectsWithOutput = targetProjects.filter(p => p.hasOutput);
    if (projectsWithOutput.length === 0) {
      throw new Error(
        `Workspace detected (${ws.configFile}) with projects [${targetProjects.map(p => p.name || p.path).join(', ')}], but no build output found. Please run your build first or pass --build.`
      );
    }

    // Run audit for each project independently
    const projectResults = [];
    for (const proj of projectsWithOutput) {
      const report = await auditSingleProject({
        cwd: proj.fullPath,
        dir: proj.outputDir,
        build: false,
        projectName: proj.name,
        projectPath: proj.path,
        region: options.region,
        all: options.all,
        failOn: options.failOn,
        threshold: options.threshold,
        ci: options.ci
      });
      projectResults.push({
        name: proj.name,
        path: proj.path,
        fullPath: proj.fullPath,
        outputDir: proj.outputDir,
        report
      });
    }

    const totalProjects = projectResults.length;
    const gapProjects = projectResults.filter(p => p.report.hasGaps).length;
    const compliantProjects = totalProjects - gapProjects;
    const hasGaps = gapProjects > 0;
    const verdict = hasGaps ? 'COMPATIBILITY GAP DETECTED' : 'COMPLIANT';
    const firstProjectReport = projectResults[0]?.report;
    const region = firstProjectReport?.region || options.region || 'global';
    const regionLabel = firstProjectReport?.regionLabel || (region === 'global' ? 'Global' : region.toUpperCase());

    const threshold = options.failOn || options.threshold || (options.ci ? 'BLOCKING' : null);
    const normThreshold = normalizeThreshold(threshold);
    const failingProjects = projectResults.filter(p => !p.report.ciResult?.passed);
    const totalFailingIssues = projectResults.reduce((acc, p) => acc + (p.report.ciResult?.failingIssuesCount || 0), 0);
    const ciResult = {
      passed: failingProjects.length === 0,
      threshold: normThreshold,
      failingIssuesCount: totalFailingIssues,
      failingProjects: failingProjects.map(p => p.name || p.path)
    };

    return {
      isMonorepo: true,
      workspaceConfig: ws.configFile,
      region,
      regionLabel,
      summary: {
        totalProjects,
        compliantProjects,
        gapProjects,
        hasGaps,
        verdict
      },
      hasGaps,
      ciResult,
      projects: projectResults
    };
  }

  // Fallback to single project detection
  return auditSingleProject(options);
}
