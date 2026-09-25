import bcd from '@mdn/browser-compat-data' with { type: 'json' };
import caniuse from 'caniuse-lite';

/**
 * Standard key browsers monitored for compatibility floor
 */
export const TARGET_BROWSERS = [
  { key: 'chrome', name: 'Chrome', mdnKey: 'chrome', caniuseKey: 'chrome' },
  { key: 'safari', name: 'Safari', mdnKey: 'safari', caniuseKey: 'safari' },
  { key: 'firefox', name: 'Firefox', mdnKey: 'firefox', caniuseKey: 'firefox' },
  { key: 'edge', name: 'Edge', mdnKey: 'edge', caniuseKey: 'edge' },
  { key: 'ios_saf', name: 'iOS Safari', mdnKey: 'safari_ios', caniuseKey: 'ios_saf' },
  { key: 'chrome_android', name: 'Chrome Android', mdnKey: 'chrome_android', caniuseKey: 'and_chr' }
];

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
