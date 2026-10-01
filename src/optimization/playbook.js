/**
 * Optimization Playbook & Remediation Catalog for /compat-optimize skill
 */
export const REMEDIATION_CATALOG = {
  // --- Lightweight Runtime Polyfills (< 1KB) ---
  'javascript.builtins.Array.at': {
    fix: 'Add tiny Array.prototype.at polyfill in entry',
    pkg: null,
    costKb: 0.1,
    strategy: 'inline_shim',
    appAdvice: 'Add inline Array.prototype.at shim in src/polyfills.ts',
    vendorAdvice: 'Add global Array.prototype.at shim in src/polyfills.ts before vendor bundle loads'
  },
  'javascript.builtins.Object.hasOwn': {
    fix: 'Add tiny Object.hasOwn polyfill in entry',
    pkg: null,
    costKb: 0.1,
    strategy: 'inline_shim',
    appAdvice: 'Add inline Object.hasOwn shim in src/polyfills.ts or use Object.prototype.hasOwnProperty.call(obj, prop)',
    vendorAdvice: 'Add global Object.hasOwn shim in src/polyfills.ts before vendor bundle loads'
  },
  'javascript.builtins.Promise.allSettled': {
    fix: 'Add inline Promise.allSettled polyfill in entry',
    pkg: 'promise.allsettled',
    costKb: 0.4,
    strategy: 'inline_shim',
    appAdvice: 'Add tiny Promise.allSettled shim in src/polyfills.ts',
    vendorAdvice: 'Add global Promise.allSettled shim in src/polyfills.ts'
  },
  'javascript.builtins.Promise.any': {
    fix: 'Add Promise.any polyfill or core-js ponyfill',
    pkg: 'promise.any',
    costKb: 0.5,
    strategy: 'inline_shim',
    appAdvice: 'Add Promise.any shim or install promise.any',
    vendorAdvice: 'Add global Promise.any shim in src/polyfills.ts'
  },
  'javascript.builtins.String.replaceAll': {
    fix: 'Add String.prototype.replaceAll polyfill in entry',
    pkg: 'string.prototype.replaceall',
    costKb: 0.3,
    strategy: 'inline_shim',
    appAdvice: 'Add String.prototype.replaceAll shim in src/polyfills.ts or use .replace(/.../g)',
    vendorAdvice: 'Add global String.prototype.replaceAll shim in src/polyfills.ts'
  },
  'api.structuredClone': {
    fix: 'Import @ungap/structured-clone (1.2KB) in entry or refactor to JSON clone for DTOs',
    pkg: '@ungap/structured-clone',
    costKb: 1.2,
    strategy: 'package',
    appAdvice: 'Prompt developer via ask_question: install @ungap/structured-clone (1.2KB) for full spec compliance (Map, Set, Buffer, circular refs) or refactor to JSON clone if only DTOs',
    vendorAdvice: 'Install @ungap/structured-clone and assign globalThis.structuredClone in src/polyfills.ts',
    decisionOptions: [
      {
        label: '(Recommended) Install @ungap/structured-clone (1.2KB gzip) for full spec compliance (Map, Set, ArrayBuffer, circular refs)',
        action: 'install_package',
        pkg: '@ungap/structured-clone'
      },
      {
        label: 'Refactor app code to JSON.parse(JSON.stringify(dto)) if cloning only plain serializable objects',
        action: 'refactor_code'
      },
      {
        label: 'Add minimal recursive deep-clone shim in src/polyfills.ts (handles POJOs, Arrays, Dates, RegExps and circular refs)',
        action: 'inline_shim'
      }
    ]
  },
  'api.Crypto.randomUUID': {
    fix: 'Use crypto.getRandomValues fallback or uuid v4',
    pkg: null,
    costKb: 0.2,
    strategy: 'inline_shim',
    appAdvice: 'Add tiny RFC 4122 v4 generator using crypto.getRandomValues() in src/polyfills.ts',
    vendorAdvice: 'Add global crypto.randomUUID shim in src/polyfills.ts'
  },
  'api.queueMicrotask': {
    fix: 'Add queue-microtask or Promise.resolve polyfill',
    pkg: 'queue-microtask',
    costKb: 0.3,
    strategy: 'inline_shim',
    appAdvice: 'Add window.queueMicrotask = fn => Promise.resolve().then(fn) in src/polyfills.ts',
    vendorAdvice: 'Add global queueMicrotask shim in src/polyfills.ts'
  },
  'javascript.builtins.Promise.withResolvers': {
    fix: 'Add tiny inline Promise.withResolvers polyfill in entry',
    pkg: null,
    costKb: 0.1,
    strategy: 'inline_shim',
    appAdvice: 'Add inline Promise.withResolvers shim in src/polyfills.ts',
    vendorAdvice: 'Add global Promise.withResolvers shim in src/polyfills.ts'
  },
  'javascript.builtins.Object.groupBy': {
    fix: 'Add tiny inline Object.groupBy polyfill in entry',
    pkg: null,
    costKb: 0.15,
    strategy: 'inline_shim',
    appAdvice: 'Add inline Object.groupBy shim in src/polyfills.ts',
    vendorAdvice: 'Add global Object.groupBy shim in src/polyfills.ts'
  },
  'javascript.builtins.Map.groupBy': {
    fix: 'Add tiny inline Map.groupBy polyfill in entry',
    pkg: null,
    costKb: 0.15,
    strategy: 'inline_shim',
    appAdvice: 'Add inline Map.groupBy shim in src/polyfills.ts',
    vendorAdvice: 'Add global Map.groupBy shim in src/polyfills.ts'
  },
  'javascript.builtins.Array.fromAsync': {
    fix: 'Add inline Array.fromAsync polyfill in entry',
    pkg: null,
    costKb: 0.3,
    strategy: 'inline_shim',
    appAdvice: 'Add inline Array.fromAsync shim in src/polyfills.ts',
    vendorAdvice: 'Add global Array.fromAsync shim in src/polyfills.ts'
  },
  'javascript.builtins.Set.union': {
    fix: 'Add inline Set.prototype.union polyfill in entry',
    pkg: null,
    costKb: 0.1,
    strategy: 'inline_shim',
    appAdvice: 'Add inline Set.prototype.union shim in src/polyfills.ts',
    vendorAdvice: 'Add global Set.prototype.union shim in src/polyfills.ts'
  },
  'javascript.builtins.Set.intersection': {
    fix: 'Add inline Set.prototype.intersection polyfill in entry',
    pkg: null,
    costKb: 0.1,
    strategy: 'inline_shim',
    appAdvice: 'Add inline Set.prototype.intersection shim in src/polyfills.ts',
    vendorAdvice: 'Add global Set.prototype.intersection shim in src/polyfills.ts'
  },

  // --- Bundler Config & CSS Transforms ---
  'javascript.operators.optional_chaining': {
    fix: 'Adjust bundler target (e.g. Vite target: "es2019")',
    pkg: null,
    costKb: 0,
    strategy: 'bundler_target',
    appAdvice: 'Configure bundler build.target to "es2019" or transpile via SWC/Babel',
    vendorAdvice: 'Configure bundler to transpile untranspiled dependency (e.g. vite optimizeDeps or swc/babel)'
  },
  'javascript.operators.nullish_coalescing': {
    fix: 'Adjust bundler target (e.g. Vite target: "es2019")',
    pkg: null,
    costKb: 0,
    strategy: 'bundler_target',
    appAdvice: 'Configure bundler build.target to "es2019" or transpile via SWC/Babel',
    vendorAdvice: 'Configure bundler to transpile untranspiled dependency'
  },
  'javascript.operators.logical_assignment': {
    fix: 'Adjust bundler target to ES2020 in config',
    pkg: null,
    costKb: 0,
    strategy: 'bundler_target',
    appAdvice: 'Configure bundler build.target to "es2020"',
    vendorAdvice: 'Configure bundler to transpile untranspiled dependency'
  },
  'javascript.classes.private_class_fields': {
    fix: 'Lower target in Vite/esbuild to "es2021"',
    pkg: null,
    costKb: 0.5,
    strategy: 'bundler_target',
    appAdvice: 'Lower target in bundler to "es2021" or transpile private class fields',
    vendorAdvice: 'Configure bundler to transpile untranspiled dependency'
  },
  'css.selectors.nesting': {
    fix: 'Enable postcss-nested in postcss.config.js',
    pkg: 'postcss-nested',
    costKb: 0,
    strategy: 'bundler_target',
    appAdvice: 'Add postcss-nested or postcss-preset-env in postcss.config.js',
    vendorAdvice: 'Add postcss-preset-env in build pipeline'
  },
  'css.types.color.color-mix': {
    fix: 'Enable @csstools/postcss-color-mix in PostCSS',
    pkg: 'postcss-preset-env',
    costKb: 0,
    strategy: 'bundler_target',
    appAdvice: 'Add @csstools/postcss-color-mix or postcss-preset-env',
    vendorAdvice: 'Pre-compile CSS during build'
  },
  'css.types.color.oklch': {
    fix: 'Add @csstools/postcss-oklab-function in PostCSS',
    pkg: '@csstools/postcss-oklab-function',
    costKb: 0,
    strategy: 'bundler_target',
    appAdvice: 'Add @csstools/postcss-oklab-function in PostCSS',
    vendorAdvice: 'Pre-compile CSS during build'
  },
  'css.types.color.light-dark': {
    fix: 'Use @media (prefers-color-scheme) or CSS variables fallback for light-dark()',
    pkg: 'postcss-preset-env',
    costKb: 0,
    strategy: 'progressive_css',
    appAdvice: 'Add CSS variables fallback with @media (prefers-color-scheme) or postcss-preset-env',
    vendorAdvice: 'Add PostCSS transform or CSS variables fallback'
  },

  // --- Safari & WebKit Visual Quirks ---
  'safari.css.backdrop-filter-prefix': {
    fix: 'Add -webkit-backdrop-filter alongside backdrop-filter (Safari < 18 requirement)',
    pkg: null,
    costKb: 0,
    strategy: 'progressive_css',
    appAdvice: 'Prepend -webkit-backdrop-filter before backdrop-filter',
    vendorAdvice: 'Ensure autoprefixer / postcss is enabled on vendor styles'
  },
  'safari.css.100vh-viewport': {
    fix: 'Use graceful degradation: height: 100vh; @supports (height: 100dvh) { height: 100dvh; }',
    pkg: null,
    costKb: 0,
    strategy: 'progressive_css',
    appAdvice: 'Declare height: 100vh; followed by height: 100dvh; or use @supports (height: 100dvh)',
    vendorAdvice: 'Declare fallback height: 100vh'
  },
  'safari.css.aspect-ratio-flex': {
    fix: 'Add min-width: 0 (or min-height: 0) to flex items with aspect-ratio to prevent WebKit blowout',
    pkg: null,
    costKb: 0,
    strategy: 'progressive_css',
    appAdvice: 'Add min-width: 0 (or min-height: 0) to flex item containing aspect-ratio',
    vendorAdvice: 'Add min-width: 0 to flex container or item'
  },
  'safari.css.sticky-overflow-trap': {
    fix: 'Avoid overflow: hidden/auto/scroll on ancestors of position: sticky elements in WebKit',
    pkg: null,
    costKb: 0,
    strategy: 'progressive_css',
    appAdvice: 'Remove overflow: hidden/auto from ancestor elements of sticky container',
    vendorAdvice: 'Inspect container hierarchy'
  },
  'safari.css.line-clamp-prefix': {
    fix: 'Add display: -webkit-box; -webkit-line-clamp: N; -webkit-box-orient: vertical; alongside line-clamp',
    pkg: null,
    costKb: 0,
    strategy: 'progressive_css',
    appAdvice: 'Add display: -webkit-box; -webkit-line-clamp: N; -webkit-box-orient: vertical; alongside line-clamp',
    vendorAdvice: 'Ensure autoprefixer handles line-clamp'
  },
  'safari.css.appearance-none': {
    fix: 'Add -webkit-appearance: none; appearance: none; to disable native iOS form styling',
    pkg: null,
    costKb: 0,
    strategy: 'progressive_css',
    appAdvice: 'Prepend -webkit-appearance: none; before appearance: none;',
    vendorAdvice: 'Prepend -webkit-appearance: none'
  },
  'safari.css.text-size-adjust': {
    fix: 'Add -webkit-text-size-adjust: 100%; text-size-adjust: 100%; to html/:root',
    pkg: null,
    costKb: 0,
    strategy: 'progressive_css',
    appAdvice: 'Add -webkit-text-size-adjust: 100%; text-size-adjust: 100%; to html / :root',
    vendorAdvice: 'Add -webkit-text-size-adjust to base styles'
  },

  // --- Moderate Polyfills (5-20KB) ---
  'api.ResizeObserver': {
    fix: 'Import resize-observer-polyfill (2.5KB gzip) dynamically if !window.ResizeObserver.',
    pkg: 'resize-observer-polyfill',
    costKb: 2.5,
    strategy: 'package',
    appAdvice: 'Dynamically import resize-observer-polyfill if !window.ResizeObserver, or use window resize fallback',
    vendorAdvice: 'Install resize-observer-polyfill and load dynamically if missing',
    decisionOptions: [
      {
        label: '(Recommended) Load resize-observer-polyfill dynamically only when !window.ResizeObserver',
        action: 'dynamic_import',
        pkg: 'resize-observer-polyfill'
      },
      {
        label: 'Refactor component to standard window resize event listener if simple viewport tracking',
        action: 'refactor_code'
      }
    ]
  },
  'api.IntersectionObserver': {
    fix: 'Load intersection-observer polyfill (2.7KB gzip) if !window.IntersectionObserver.',
    pkg: 'intersection-observer',
    costKb: 2.7,
    strategy: 'package',
    appAdvice: 'Dynamically import intersection-observer if !window.IntersectionObserver, or use scroll event fallback',
    vendorAdvice: 'Install intersection-observer and load dynamically if missing',
    decisionOptions: [
      {
        label: '(Recommended) Load intersection-observer polyfill dynamically only when !window.IntersectionObserver',
        action: 'dynamic_import',
        pkg: 'intersection-observer'
      },
      {
        label: 'Use native scroll event listener or eager-loading fallback if lazy-loading images/lists',
        action: 'refactor_code'
      }
    ]
  },

  // --- Structural Architectural Adjustments ---
  'css.selectors.has': {
    fix: 'Dynamic :has() cannot be polyfilled in CSS without heavy JS runtime selector engines. Use parent CSS class toggling in component state.',
    pkg: null,
    costKb: 0,
    strategy: 'structural',
    appAdvice: 'Toggle class on parent container via component state (React/Vue/Svelte) instead of relying on :has()',
    vendorAdvice: 'Avoid :has() for critical layout styles in shared libraries'
  },
  'css.at-rules.container': {
    fix: 'Container queries polyfill has high layout recalibration cost. Consider ResizeObserver with data attributes or standard media queries for critical paths.',
    pkg: null,
    costKb: 0,
    strategy: 'structural',
    appAdvice: 'Use standard media queries or ResizeObserver data-attribute attributes for critical responsive elements',
    vendorAdvice: 'Use standard responsive patterns for shared components'
  }
};

/**
 * Retrieve suggested optimization for a feature key
 */
export function getOptimizationForFeature(featureKey) {
  return REMEDIATION_CATALOG[featureKey] || null;
}
