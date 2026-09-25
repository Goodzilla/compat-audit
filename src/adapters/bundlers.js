import fs from 'node:fs';
import path from 'node:path';

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
    if (fs.existsSync(wsDir) && fs.statSync(wsDir).isDirectory()) {
      try {
        const subdirs = fs.readdirSync(wsDir, { withFileTypes: true });
        for (const sub of subdirs) {
          if (sub.isDirectory()) {
            searchDirs.push(path.join(wsDir, sub.name));
          }
        }
      } catch {}
    }
  }

  // 1. Check Vite configs
  const viteFilenames = ['vite.config.ts', 'vite.config.js', 'vite.config.mjs', 'vite.config.base.js'];
  for (const dir of searchDirs) {
    for (const fn of viteFilenames) {
      const full = path.join(dir, fn);
      if (fs.existsSync(full)) {
        config.bundler = 'vite';
        const rel = path.relative(baseDir, full);
        if (!config.configsFound.includes(rel)) config.configsFound.push(rel);
        const content = fs.readFileSync(full, 'utf-8');
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
      if (fs.existsSync(full)) {
        const rel = path.relative(baseDir, full);
        if (!config.configsFound.includes(rel)) config.configsFound.push(rel);
        const content = fs.readFileSync(full, 'utf-8');
        if (content.includes('postcss-preset-env') && !config.postcssPlugins.includes('postcss-preset-env')) {
          config.postcssPlugins.push('postcss-preset-env');
        }
        if (content.includes('postcss-nested') && !config.postcssPlugins.includes('postcss-nested')) {
          config.postcssPlugins.push('postcss-nested');
        }
        if (content.includes('custom-media') && !config.postcssPlugins.includes('postcss-custom-media')) {
          config.postcssPlugins.push('postcss-custom-media');
        }
      }
    }
  }

  // 3. Check Browserslist
  const browserslistPaths = ['.browserslistrc', 'package.json'];
  for (const bp of browserslistPaths) {
    const full = path.resolve(baseDir, bp);
    if (fs.existsSync(full)) {
      if (bp === '.browserslistrc') {
        config.browserslist = fs.readFileSync(full, 'utf-8').trim().split('\n').filter(Boolean);
        config.configsFound.push(bp);
      } else {
        try {
          const pkg = JSON.parse(fs.readFileSync(full, 'utf-8'));
          if (pkg.browserslist) {
            config.browserslist = pkg.browserslist;
            config.configsFound.push('package.json#browserslist');
          }
        } catch {}
      }
    }
  }

  return config;
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

  return notes;
}
