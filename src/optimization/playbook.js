/**
 * Optimization Playbook & Remediation Catalog for /compat-optimize skill
 */
export const REMEDIATION_CATALOG = {
  // --- Lightweight Runtime Polyfills (< 1KB) ---
  'javascript.builtins.Array.at': {
    fix: 'Add tiny Array.prototype.at polyfill in entry',
    pkg: null,
    costKb: 0.1
  },
  'javascript.builtins.Object.hasOwn': {
    fix: 'Add tiny Object.hasOwn polyfill in entry',
    pkg: null,
    costKb: 0.1
  },
  'javascript.builtins.Promise.allSettled': {
    fix: 'Add inline Promise.allSettled polyfill in entry',
    pkg: 'promise.allsettled',
    costKb: 0.4
  },
  'javascript.builtins.Promise.any': {
    fix: 'Add Promise.any polyfill or core-js ponyfill',
    pkg: 'promise.any',
    costKb: 0.5
  },
  'javascript.builtins.String.replaceAll': {
    fix: 'Add String.prototype.replaceAll polyfill in entry',
    pkg: 'string.prototype.replaceall',
    costKb: 0.3
  },
  'api.structuredClone': {
    fix: 'Import @ungap/structured-clone (1.2KB) in entry',
    pkg: '@ungap/structured-clone',
    costKb: 1.2
  },
  'api.Crypto.randomUUID': {
    fix: 'Use crypto.getRandomValues fallback or uuid v4',
    pkg: null,
    costKb: 0.2
  },
  'api.queueMicrotask': {
    fix: 'Add queue-microtask or Promise.resolve polyfill',
    pkg: 'queue-microtask',
    costKb: 0.3
  },
  'javascript.builtins.Promise.withResolvers': {
    fix: 'Add tiny inline Promise.withResolvers polyfill in entry',
    pkg: null,
    costKb: 0.1
  },
  'javascript.builtins.Object.groupBy': {
    fix: 'Add tiny inline Object.groupBy polyfill in entry',
    pkg: null,
    costKb: 0.15
  },
  'javascript.builtins.Map.groupBy': {
    fix: 'Add tiny inline Map.groupBy polyfill in entry',
    pkg: null,
    costKb: 0.15
  },
  'javascript.builtins.Array.fromAsync': {
    fix: 'Add inline Array.fromAsync polyfill in entry',
    pkg: null,
    costKb: 0.3
  },
  'javascript.builtins.Set.union': {
    fix: 'Add inline Set.prototype.union polyfill in entry',
    pkg: null,
    costKb: 0.1
  },
  'javascript.builtins.Set.intersection': {
    fix: 'Add inline Set.prototype.intersection polyfill in entry',
    pkg: null,
    costKb: 0.1
  },

  // --- Bundler Config & CSS Transforms ---
  'javascript.operators.optional_chaining': {
    fix: 'Adjust bundler target (e.g. Vite target: "es2019")',
    pkg: null,
    costKb: 0
  },
  'javascript.operators.nullish_coalescing': {
    fix: 'Adjust bundler target (e.g. Vite target: "es2019")',
    pkg: null,
    costKb: 0
  },
  'javascript.operators.logical_assignment': {
    fix: 'Adjust bundler target to ES2020 in config',
    pkg: null,
    costKb: 0
  },
  'javascript.classes.private_class_fields': {
    fix: 'Lower target in Vite/esbuild to "es2021"',
    pkg: null,
    costKb: 0.5
  },
  'css.selectors.nesting': {
    fix: 'Enable postcss-nested in postcss.config.js',
    pkg: 'postcss-nested',
    costKb: 0
  },
  'css.types.color.color-mix': {
    fix: 'Enable @csstools/postcss-color-mix in PostCSS',
    pkg: 'postcss-preset-env',
    costKb: 0
  },
  'css.types.color.oklch': {
    fix: 'Add @csstools/postcss-oklab-function in PostCSS',
    pkg: '@csstools/postcss-oklab-function',
    costKb: 0
  },
  'css.types.color.light-dark': {
    fix: 'Use @media (prefers-color-scheme) or CSS variables fallback for light-dark()',
    pkg: 'postcss-preset-env',
    costKb: 0
  },

  // --- Safari & WebKit Visual Quirks ---
  'safari.css.backdrop-filter-prefix': {
    fix: 'Add -webkit-backdrop-filter alongside backdrop-filter (Safari < 18 requirement)',
    pkg: null,
    costKb: 0
  },
  'safari.css.100vh-viewport': {
    fix: 'Use graceful degradation: height: 100vh; @supports (height: 100dvh) { height: 100dvh; }',
    pkg: null,
    costKb: 0
  },
  'safari.css.aspect-ratio-flex': {
    fix: 'Add min-width: 0 (or min-height: 0) to flex items with aspect-ratio to prevent WebKit blowout',
    pkg: null,
    costKb: 0
  },
  'safari.css.sticky-overflow-trap': {
    fix: 'Avoid overflow: hidden/auto/scroll on ancestors of position: sticky elements in WebKit',
    pkg: null,
    costKb: 0
  },
  'safari.css.line-clamp-prefix': {
    fix: 'Add display: -webkit-box; -webkit-line-clamp: N; -webkit-box-orient: vertical; alongside line-clamp',
    pkg: null,
    costKb: 0
  },
  'safari.css.appearance-none': {
    fix: 'Add -webkit-appearance: none; appearance: none; to disable native iOS form styling',
    pkg: null,
    costKb: 0
  },
  'safari.css.text-size-adjust': {
    fix: 'Add -webkit-text-size-adjust: 100%; text-size-adjust: 100%; to html/:root',
    pkg: null,
    costKb: 0
  },

  // --- Moderate Polyfills (5-20KB) ---
  'api.ResizeObserver': {
    fix: 'Import resize-observer-polyfill (2.5KB gzip) dynamically if !window.ResizeObserver.',
    pkg: 'resize-observer-polyfill',
    costKb: 2.5
  },
  'api.IntersectionObserver': {
    fix: 'Load intersection-observer polyfill (2.7KB gzip) if !window.IntersectionObserver.',
    pkg: 'intersection-observer',
    costKb: 2.7
  },

  // --- Structural Architectural Adjustments ---
  'css.selectors.has': {
    fix: 'Dynamic :has() cannot be polyfilled in CSS without heavy JS runtime selector engines. Use parent CSS class toggling in component state.',
    pkg: null,
    costKb: 0
  },
  'css.at-rules.container': {
    fix: 'Container queries polyfill has high layout recalibration cost. Consider ResizeObserver with data attributes or standard media queries for critical paths.',
    pkg: null,
    costKb: 0
  }
};

/**
 * Retrieve suggested optimization for a feature key
 */
export function getOptimizationForFeature(featureKey) {
  return REMEDIATION_CATALOG[featureKey] || null;
}
