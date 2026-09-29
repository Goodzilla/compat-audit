import fs from 'node:fs';
import path from 'node:path';
import { TARGET_BROWSERS, getBaselineSupport } from '../data/compat-db.js';

/**
 * Inspect project configuration files to detect declared browser targets and bundler settings
 */
export function inspectProjectConfig(baseDir = process.cwd()) {
  const config = {
    bundler: 'unknown',
    target: null,
    browserslist: null,
    postcssPlugins: [],
    configsFound: []
  };

  // 1. Discover potential config files in baseDir and workspace subdirectories
  const searchDirs = [baseDir];
  for (const ws of ['apps', 'packages']) {
    const wsDir = path.resolve(baseDir, ws);
    try {
      if (fs.existsSync(wsDir) && fs.statSync(wsDir).isDirectory()) {
        const subdirs = fs.readdirSync(wsDir, { withFileTypes: true });
        for (const sub of subdirs) {
          if (sub.isDirectory()) searchDirs.push(path.join(wsDir, sub.name));
        }
      }
    } catch {}
  }

  const readFileSafe = (filePath) => {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch {
      return null;
    }
  };

  // 1. Check Vite configs
  const viteFilenames = ['vite.config.ts', 'vite.config.js', 'vite.config.mjs', 'vite.config.base.js'];
  for (const dir of searchDirs) {
    for (const fn of viteFilenames) {
      const full = path.join(dir, fn);
      const content = readFileSafe(full);
      if (content !== null) {
        config.bundler = 'vite';
        const rel = path.relative(baseDir, full);
        if (!config.configsFound.includes(rel)) config.configsFound.push(rel);
        const targetMatch = content.match(/target:\s*['"]([^'"]+)['"]/);
        if (targetMatch && !config.target) {
          config.target = targetMatch[1];
        }
      }
    }
  }

  // 2. Check PostCSS configs
  const postcssFilenames = ['postcss.config.js', 'postcss.config.mjs', 'postcss.config.cjs'];
  for (const dir of searchDirs) {
    for (const fn of postcssFilenames) {
      const full = path.join(dir, fn);
      const content = readFileSafe(full);
      if (content !== null) {
        const rel = path.relative(baseDir, full);
        if (!config.configsFound.includes(rel)) config.configsFound.push(rel);
        for (const plugin of ['postcss-preset-env', 'postcss-nested', 'postcss-custom-media']) {
          if (content.includes(plugin) && !config.postcssPlugins.includes(plugin)) {
            config.postcssPlugins.push(plugin);
          }
        }
      }
    }
  }

  // 3. Check Browserslist
  for (const dir of searchDirs) {
    const brc = readFileSafe(path.join(dir, '.browserslistrc'));
    if (brc !== null) {
      config.browserslist = brc.trim().split('\n').filter(Boolean);
      config.configsFound.push(path.relative(baseDir, path.join(dir, '.browserslistrc')));
      break;
    }
    const pkgRaw = readFileSafe(path.join(dir, 'package.json'));
    if (pkgRaw !== null) {
      try {
        const pkg = JSON.parse(pkgRaw);
        if (pkg.browserslist) {
          config.browserslist = pkg.browserslist;
          config.configsFound.push(path.relative(baseDir, path.join(dir, 'package.json')) + '#browserslist');
          break;
        }
      } catch {}
    }
  }

  // 4. Check tsconfig.json if target not yet set
  if (!config.target) {
    const tsconfigPaths = ['tsconfig.json', 'tsconfig.base.json'];
    for (const dir of searchDirs) {
      for (const tp of tsconfigPaths) {
        const full = path.join(dir, tp);
        const content = readFileSafe(full);
        if (content !== null) {
          const m = content.match(/"target"\s*:\s*"([^"]+)"/i);
          if (m) {
            config.target = m[1];
            const rel = path.relative(baseDir, full);
            if (!config.configsFound.includes(rel)) config.configsFound.push(rel);
            break;
          }
        }
      }
      if (config.target) break;
    }
  }

  return config;
}

/**
 * Resolve declared browser target versions and labels
 */
export function resolveDeclaredTargets(config = {}) {
  const targetLabel = config.target || (Array.isArray(config.browserslist) ? config.browserslist.join(', ') : 'ES2015');
  const baselineSupport = getBaselineSupport(typeof config.target === 'string' ? config.target : 'ES2015');
  const result = {};

  for (const b of TARGET_BROWSERS) {
    let ver = baselineSupport[b.key] || 1;
    let label = targetLabel;

    const parseVersion = (val) => {
      const m = String(val).match(new RegExp(`(?:${b.key}|${b.name})\\s*(?:>=?\\s*)?([0-9.]+)`, 'i'));
      return m ? parseFloat(m[1]) : null;
    };

    if (typeof config.target === 'string') {
      const v = parseVersion(config.target);
      if (v !== null) {
        ver = v;
        label = `${b.name} ${ver}+`;
      }
    } else if (Array.isArray(config.target)) {
      for (const item of config.target) {
        const v = parseVersion(item);
        if (v !== null) {
          ver = v;
          label = `${b.name} ${ver}+`;
          break;
        }
      }
    } else if (Array.isArray(config.browserslist)) {
      for (const item of config.browserslist) {
        const v = parseVersion(item);
        if (v !== null) {
          ver = v;
          label = `${b.name} ${ver}+`;
          break;
        }
      }
    }

    result[b.key] = {
      browser: b.name,
      targetVersion: ver,
      label
    };
  }

  return { targetLabel, browsers: result };
}

/**
 * Generate "Intent vs Reality" diagnostic notes
 */
export function compareIntentVsReality(config, findings) {
  const notes = [];

  // Check Vite target vs Runtime Web APIs
  if (config.target) {
    const runtimeApiFindings = findings.filter(f => f.category === 'api' || f.category === 'builtin');
    if (runtimeApiFindings.length > 0) {
      notes.push({
        type: 'warning',
        title: 'Syntax vs Runtime Gap',
        message: `Your bundler targets '${config.target}', but the bundle contains runtime Web APIs (${runtimeApiFindings.slice(0, 3).map(f => f.name).join(', ')}). Bundlers transpile JavaScript syntax (like arrow functions or classes) but DO NOT polyfill global runtime APIs without dedicated polyfills.`
      });
    }
  }

  // Check CSS features vs PostCSS
  const hasCssNesting = findings.some(f => f.featureKey === 'css.selectors.nesting');
  if (hasCssNesting && !config.postcssPlugins.includes('postcss-nested') && !config.postcssPlugins.includes('postcss-preset-env')) {
    notes.push({
      type: 'info',
      title: 'CSS Nesting without fallback',
      message: 'Native CSS nesting (&) is emitted in your CSS bundle. Older browser engines (Safari < 16.5, Chrome < 112) will ignore these nested rules.'
    });
  }

  // Check Safari & WebKit visual quirks
  const safariQuirks = findings.filter(f => f.category === 'safari-quirk');
  if (safariQuirks.length > 0) {
    notes.push({
      type: 'warning',
      title: 'Safari & WebKit Visual Quirks Detected',
      message: `Detected ${safariQuirks.length} WebKit rendering pitfall(s): ${safariQuirks.map(q => q.name).join(', ')}. Safari requires dedicated vendor prefixes (-webkit-) and graceful degradation for layout stability.`
    });
  }

  return notes;
}
