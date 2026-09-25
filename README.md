# compat-audit

Scan compiled frontend bundles to determine minimum browser versions and identify fixes for older browser support.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)

## Background

Most compatibility tools run during linting on source files. While useful, static linting misses what actually reaches the browser:

1. Bundlers transpile syntax (such as optional chaining or class fields) to an older ECMAScript target, but do not polyfill runtime Web APIs (such as `structuredClone`, `crypto.randomUUID`, or `ResizeObserver`).
2. Dependencies from `node_modules` can introduce newer APIs or modern CSS rules that bypass project linting rules.
3. Lint errors treat a missing 100-byte polyfill and a missing layout engine feature with the same severity, without indicating how much effort is needed to restore compatibility.

`compat-audit` inspects production output files (JavaScript, CSS, and HTML) using AST parsers, cross-references findings against MDN Browser Compat Data and Can I Use statistics, and estimates the real minimum browser versions required by your build.

## How it works

1. **Asset Discovery**: Locates the build output folder (`dist`, `.svelte-kit/output/client`, `.next/static`, `build`, or a custom path).
2. **AST Analysis**:
   - JavaScript: Uses Acorn to scan for ECMAScript syntax versions, global Web APIs, and prototype method usage.
   - CSS: Uses CSSTree to scan for selectors (`:has()`, `:is()`), at-rules (`@container`, `@layer`), and modern color functions (`color-mix`, `oklch`).
   - HTML: Uses htmlparser2 to scan for modern elements and attributes.
3. **Intent versus Reality Check**: Compares detected bundler settings (like `target: 'es2015'` in Vite or PostCSS configuration) against features found in the generated bundles.
4. **Effort Tiers**: Groups issues by remediation difficulty to distinguish trivial polyfills from deeper architectural constraints.

## Effort Tiers

Issues are categorized into four levels:

- **E1 (Trivial polyfill, around 5 minutes)**: Lightweight runtime polyfill with minimal size overhead (`Array.prototype.at`, `structuredClone`, `Object.hasOwn`).
- **E2 (Configuration change, around 15 minutes)**: Bundler target adjustments or PostCSS plugins (syntax downleveling, CSS nesting transforms, color fallbacks).
- **E3 (Moderate polyfill, around 45 minutes)**: Larger polyfills with potential runtime or bundle size trade-offs (`ResizeObserver`, `IntersectionObserver`).
- **E4 (Architectural refactor)**: Features that lack lightweight polyfills and require layout or architectural alternatives (such as dynamic `:has()` or `@container`).

## Installation

Run directly with npx:

```bash
npx compat-audit
```

Or install as a development dependency:

```bash
npm install --save-dev compat-audit
npx compat-audit dist/
```

## CLI Usage

```bash
compat-audit [directory] [options]
```

### Options

| Flag | Description | Default |
|---|---|---|
| `[dir]` | Target directory with compiled assets | Auto-detected |
| `--format <type>` | Output format: `terminal`, `json`, `markdown` | `terminal` |
| `--json` | Shorthand for `--format json` | |
| `--markdown`, `--md` | Shorthand for `--format markdown` | |
| `--fail-on-incompatible` | Exit with status code 1 if issues exist | `false` |
| `-h`, `--help` | Show help screen | |
| `-v`, `--version` | Show version | |

## Example Output

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                       COMPAT-AUDIT BUNDLE REPORT                          ║
╚═══════════════════════════════════════════════════════════════════════════╝

Scanned Directory: dist/
Assets Scanned:    32 files (24 JS, 8 CSS)
Estimated Coverage: 96.4% global audience

EFFECTIVE BROWSER FLOOR (Minimum required versions):
   Chrome 98+  |  Safari 15.4+  |  Firefox 94+  |  Edge 98+  |  iOS Safari 15.4+

INTENT VS REALITY DIAGNOSTIC:
   ! Syntax vs Runtime Gap: Your bundler targets 'es2018', but the bundle contains runtime Web APIs (structuredClone, crypto.randomUUID). Bundlers transpile JavaScript syntax but do not polyfill global runtime APIs without dedicated polyfills.

TOP QUICK-WINS & LOW-HANGING FRUITS (Sorted by ROI):
   ┌───────┬───────────────────────────────┬─────────────┬─────────────┬──────────────────────────────────────────┐
   │ Level │ Feature                       │ Category    │ Est. Time   │ Recommended Action                       │
   ├───────┼───────────────────────────────┼─────────────┼─────────────┼──────────────────────────────────────────┤
   │   E1  │ structuredClone()             │ api         │ ~5 mins     │ Import @ungap/structured-clone (1.2KB)   │
   │   E1  │ Array/String.prototype.at()   │ prototype   │ ~5 mins     │ Add tiny Array.prototype.at polyfill     │
   │   E1  │ Object.hasOwn()               │ builtin     │ ~5 mins     │ Add tiny Object.hasOwn polyfill in entry │
   │   E2  │ Native CSS Nesting (&)        │ selector    │ ~15 mins    │ Enable postcss-nested in configuration   │
   └───────┴───────────────────────────────┴─────────────┴─────────────┴──────────────────────────────────────────┘
```

## Programmatic API

You can also run the audit programmatically from Node.js scripts or build tools:

```javascript
import { auditBundle } from 'compat-audit';

const report = await auditBundle({
  dir: 'dist',
  cwd: process.cwd()
});

console.log(report.browserFloor);
// { chrome: 120, safari: 17.2, firefox: 121, ... }
```

## Licenses and Data Sources

- Software licensed under the [MIT License](LICENSE).
- Browser compatibility data from [@mdn/browser-compat-data](https://github.com/mdn/browser-compat-data) ([CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)).
- Browser usage statistics from [caniuse-lite](https://github.com/browserslist/caniuse-lite) ([CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/)).
- See [LICENSE-THIRD-PARTY.md](LICENSE-THIRD-PARTY.md) for details.
