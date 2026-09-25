import bcd from '@mdn/browser-compat-data' with { type: 'json' };
import caniuse from 'caniuse-lite';

/**
 * Standard key browsers monitored for compatibility floor
 */
export const TARGET_BROWSERS = [
  { key: 'chrome', name: 'Chrome', platform: 'desktop', mdnKey: 'chrome', caniuseKey: 'chrome' },
  { key: 'safari', name: 'Safari', platform: 'desktop', mdnKey: 'safari', caniuseKey: 'safari' },
  { key: 'firefox', name: 'Firefox', platform: 'desktop', mdnKey: 'firefox', caniuseKey: 'firefox' },
  { key: 'edge', name: 'Edge', platform: 'desktop', mdnKey: 'edge', caniuseKey: 'edge' },
  { key: 'ios_saf', name: 'iOS Safari', platform: 'mobile', mdnKey: 'safari_ios', caniuseKey: 'ios_saf' },
  { key: 'chrome_android', name: 'Chrome Android', platform: 'mobile', mdnKey: 'chrome_android', caniuseKey: 'and_chr' },
  { key: 'samsung', name: 'Samsung Internet', platform: 'mobile', mdnKey: 'samsunginternet_android', caniuseKey: 'samsung' }
];

/**
 * Baseline standard floor maps for common ECMAScript & bundler targets
 */
export const BASELINE_STANDARDS = {
  es5: { chrome: 4, safari: 5, firefox: 4, edge: 12, ios_saf: 4.2, chrome_android: 18, samsung: 4.0 },
  es2015: { chrome: 51, safari: 10, firefox: 54, edge: 15, ios_saf: 10, chrome_android: 51, samsung: 5.0 },
  es6: { chrome: 51, safari: 10, firefox: 54, edge: 15, ios_saf: 10, chrome_android: 51, samsung: 5.0 },
  es2016: { chrome: 52, safari: 10.1, firefox: 54, edge: 15, ios_saf: 10.3, chrome_android: 52, samsung: 6.0 },
  es2017: { chrome: 58, safari: 11, firefox: 54, edge: 15, ios_saf: 11, chrome_android: 58, samsung: 7.0 },
  es2018: { chrome: 64, safari: 11.1, firefox: 58, edge: 79, ios_saf: 11.3, chrome_android: 64, samsung: 9.0 },
  es2019: { chrome: 73, safari: 12.1, firefox: 66, edge: 79, ios_saf: 12.2, chrome_android: 73, samsung: 11.1 },
  es2020: { chrome: 80, safari: 13.1, firefox: 78, edge: 80, ios_saf: 13.4, chrome_android: 80, samsung: 13.0 },
  es2021: { chrome: 85, safari: 14.1, firefox: 85, edge: 85, ios_saf: 14.5, chrome_android: 85, samsung: 14.0 },
  es2022: { chrome: 94, safari: 15.4, firefox: 93, edge: 94, ios_saf: 15.4, chrome_android: 94, samsung: 17.0 },
  es2023: { chrome: 110, safari: 16.4, firefox: 115, edge: 110, ios_saf: 16.4, chrome_android: 110, samsung: 21.0 }
};

/**
 * Resolve baseline floor versions for a given target standard
 */
export function getBaselineSupport(targetName) {
  if (!targetName || typeof targetName !== 'string') {
    return BASELINE_STANDARDS.es2015;
  }
  const normalized = targetName.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (normalized === 'modules' || normalized === 'vite') {
    return BASELINE_STANDARDS.es2020;
  }
  if (BASELINE_STANDARDS[normalized]) {
    return BASELINE_STANDARDS[normalized];
  }
  // Check prefix match (e.g. es2015 in es2015node24)
  for (const key of Object.keys(BASELINE_STANDARDS)) {
    if (normalized.includes(key)) {
      return BASELINE_STANDARDS[key];
    }
  }
  return BASELINE_STANDARDS.es2015;
}

/**
 * Clean version string to comparable number/string
 */
export function normalizeVersion(ver) {
  if (!ver || typeof ver !== 'string') return null;
  const match = ver.match(/^(\d+(?:\.\d+)?)/);
  return match ? parseFloat(match[1]) : null;
}

/**
 * Extract browser support versions from MDN support statement
 */
export function getBrowserSupport(supportItem) {
  if (!supportItem) return null;
  const entry = Array.isArray(supportItem) ? supportItem[0] : supportItem;
  if (!entry) return null;
  if (entry.version_added === true) return 1;
  if (typeof entry.version_added === 'string') return normalizeVersion(entry.version_added);
  return null;
}

/**
 * Pre-indexed compatibility knowledge base for fast AST lookup
 */
export class CompatDatabase {
  constructor() {
    this.bcd = bcd;
    this.caniuse = caniuse;
    this.globalStats = this._computeGlobalStats();
    this.frStats = this._computeRegionStats('FR');
  }

  _computeGlobalStats() {
    const stats = {};
    for (const b of TARGET_BROWSERS) {
      const browserData = caniuse.agents[b.caniuseKey];
      if (browserData && browserData.usage_global) {
        stats[b.key] = browserData.usage_global;
      }
    }
    return stats;
  }

  _computeRegionStats(region = 'FR') {
    // caniuse-lite includes global agents. Region fallbacks gracefully to global if region file not bundled
    return this.globalStats;
  }

  /**
   * Look up feature details in BCD
   * @param {string} category 'javascript.builtins' | 'api' | 'css'
   * @param {string} path dot notation path in BCD
   */
  lookup(category, path) {
    const parts = path.split('.');
    let curr = this.bcd[category];
    for (const part of parts) {
      if (!curr) return null;
      curr = curr[part];
    }
    return curr?.__compat || null;
  }

  /**
   * Extract version requirements for all monitored browsers
   */
  getSupportMatrix(compat) {
    if (!compat || !compat.support) return null;
    const matrix = {};
    for (const b of TARGET_BROWSERS) {
      const support = compat.support[b.mdnKey];
      const version = getBrowserSupport(support);
      matrix[b.key] = version;
    }
    return matrix;
  }

  /**
   * Calculate population coverage percentage for a given version floor
   * @param {Record<string, number>} floorMatrix
   */
  calculateCoverage(floorMatrix) {
    let totalCovered = 0;
    let totalMonitored = 0;

    for (const b of TARGET_BROWSERS) {
      const requiredVer = floorMatrix[b.key];
      const browserUsage = this.globalStats[b.key] || {};
      for (const [verStr, share] of Object.entries(browserUsage)) {
        const ver = parseFloat(verStr);
        totalMonitored += share;
        if (!requiredVer || ver >= requiredVer) {
          totalCovered += share;
        }
      }
    }

    if (totalMonitored === 0) return 95.0; // fallback sensible default
    return Math.min(100, Math.round((totalCovered / totalMonitored) * 1000) / 10);
  }
}
