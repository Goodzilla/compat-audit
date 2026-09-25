/**
 * 4-Level Deterministic Effort Scoring
 */
export const EFFORT_LEVELS = {
  1: {
    label: 'Trivial Quick Win',
    timeEst: '~5 mins',
    description: 'Lightweight runtime polyfill (< 1KB) with zero architectural impact.',
    category: 'polyfill'
  },
  2: {
    label: 'Low Effort',
    timeEst: '~15 mins',
    description: 'Bundler syntax downleveling or CSS transform plugin (Vite / PostCSS / Babel).',
    category: 'config'
  },
  3: {
    label: 'Moderate Effort',
    timeEst: '~45 mins',
    description: 'Heavier polyfill or shim (5-20KB) with potential runtime/perf trade-offs.',
    category: 'heavy-polyfill'
  },
  4: {
    label: 'High Effort',
    timeEst: 'Refactor',
    description: 'Structural web feature without clean polyfill. Requires progressive enhancement.',
    category: 'refactor'
  }
};

/**
 * Known remediation catalog with pre-mapped effort scores & recommendations
 */
export const REMEDIATION_CATALOG = {
  // --- Effort 1 : Trivial Runtime Polyfills (< 1KB) ---
  'javascript.builtins.Array.at': {
    effort: 1,
    fix: 'Add tiny polyfill in entry file: if (!Array.prototype.at) Array.prototype.at = function(n) { n = Math.trunc(n) || 0; if (n < 0) n += this.length; if (n < 0 || n >= this.length) return undefined; return this[n]; };',
    pkg: null,
    costKb: 0.1
  },
  'javascript.builtins.Object.hasOwn': {
    effort: 1,
    fix: 'Add tiny polyfill: Object.hasOwn = Object.hasOwn || ((obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop));',
    pkg: null,
    costKb: 0.1
  },
  'javascript.builtins.Promise.allSettled': {
    effort: 1,
    fix: 'Add inline Promise.allSettled polyfill or core-js/actual/promise/all-settled.',
    pkg: 'promise.allsettled',
    costKb: 0.4
  },
  'javascript.builtins.Promise.any': {
    effort: 1,
    fix: 'Add Promise.any ponyfill or core-js/actual/promise/any.',
    pkg: 'promise.any',
    costKb: 0.5
  },
  'javascript.builtins.String.replaceAll': {
    effort: 1,
    fix: 'Add String.prototype.replaceAll polyfill.',
    pkg: 'string.prototype.replaceall',
    costKb: 0.3
  },
  'api.structuredClone': {
    effort: 1,
    fix: 'Import @ungap/structured-clone (1.2KB) or core-js/actual/structured-clone in entry.',
    pkg: '@ungap/structured-clone',
    costKb: 1.2
  },
  'api.Crypto.randomUUID': {
    effort: 1,
    fix: 'Use crypto.getRandomValues fallback or uuid/v4 for older browsers.',
    pkg: null,
    costKb: 0.2
  },
  'api.queueMicrotask': {
    effort: 1,
    fix: 'Add queue-microtask or Promise.resolve().then(fn) polyfill.',
    pkg: 'queue-microtask',
    costKb: 0.3
  },

  // --- Effort 2 : Bundler Config & CSS Transforms (~15 mins) ---
  'javascript.operators.optional_chaining': {
    effort: 2,
    fix: 'Adjust bundler target (e.g. Vite target: "es2019") or enable @babel/plugin-transform-optional-chaining.',
    pkg: null,
    costKb: 0
  },
  'javascript.operators.nullish_coalescing': {
    effort: 2,
    fix: 'Adjust bundler target (e.g. target: "es2019") or enable @babel/plugin-transform-nullish-coalescing-operator.',
    pkg: null,
    costKb: 0
  },
  'javascript.operators.logical_assignment': {
    effort: 2,
    fix: 'Adjust bundler target to ES2020 or enable @babel/plugin-transform-logical-assignment-operators.',
    pkg: null,
    costKb: 0
  },
  'javascript.classes.private_class_fields': {
    effort: 2,
    fix: 'Lower target in Vite/esbuild to "es2021" to transpile private class fields to WeakMap.',
    pkg: null,
    costKb: 0.5
  },
  'css.selectors.nesting': {
    effort: 2,
    fix: 'Enable postcss-nested or @csstools/postcss-nesting in postcss.config.js to unnest CSS rules for older engines.',
    pkg: 'postcss-nested',
    costKb: 0
  },
  'css.types.color.color-mix': {
    effort: 2,
    fix: 'Enable @csstools/postcss-color-mix or configure postcss-preset-env stage 2.',
    pkg: 'postcss-preset-env',
    costKb: 0
  },
  'css.types.color.oklch': {
    effort: 2,
    fix: 'Add @csstools/postcss-oklab-function plugin in postcss.config.js.',
    pkg: '@csstools/postcss-oklab-function',
    costKb: 0
  },

  // --- Effort 3 : Moderate Polyfills (5-20KB) ---
  'api.ResizeObserver': {
    effort: 3,
    fix: 'Import resize-observer-polyfill (2.5KB gzip) dynamically if !window.ResizeObserver.',
    pkg: 'resize-observer-polyfill',
    costKb: 2.5
  },
  'api.IntersectionObserver': {
    effort: 3,
    fix: 'Load intersection-observer polyfill (2.7KB gzip) if !window.IntersectionObserver.',
    pkg: 'intersection-observer',
    costKb: 2.7
  },

  // --- Effort 4 : Structural Refactors ---
  'css.selectors.has': {
    effort: 4,
    fix: 'Dynamic :has() cannot be polyfilled in CSS without heavy JS runtime selector engines. Use parent CSS class toggling in component state.',
    pkg: null,
    costKb: 0
  },
  'css.at-rules.container': {
    effort: 4,
    fix: 'Container queries polyfill has high layout recalibration cost. Consider ResizeObserver with data attributes or standard media queries for critical paths.',
    pkg: null,
    costKb: 0
  }
};

/**
 * Score an issue with effort level, remediation advice, and ROI
 */
export function scoreIssue(featureKey, name, category, currentMatrix, baselineMatrix) {
  const catalogEntry = REMEDIATION_CATALOG[featureKey] || null;

  let effort = 2; // default moderate config/polyfill
  let remediation = 'Check MDN documentation for compatible fallbacks.';
  let costKb = 0;

  if (catalogEntry) {
    effort = catalogEntry.effort;
    remediation = catalogEntry.fix;
    costKb = catalogEntry.costKb || 0;
  } else if (category === 'css' && featureKey.includes('has')) {
    effort = 4;
  } else if (category === 'api') {
    effort = 3;
  }

  return {
    featureKey,
    name,
    category,
    effort,
    effortMeta: EFFORT_LEVELS[effort],
    remediation,
    costKb
  };
}
