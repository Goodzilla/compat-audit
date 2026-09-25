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
3. **Configuration vs Bundle Verification**: Compares detected bundler settings (such as target in Vite or PostCSS configuration) against features actually emitted in the compiled bundles.
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

### Monorepo & Multi-Target Analysis Case

In real projects and monorepos, compatibility issues rarely stem from application code alone. They often leak from internal design systems or shared packages (`packages/ui`) that distribute untranspiled syntax or modern CSS directly into production:

```
================================================================================
                    COMPAT-AUDIT BUNDLE ANALYSIS REPORT                         
================================================================================

Target: apps/web (Application SPA) + packages/ui (Design System)
Scanned Assets: 48 files (32 JS, 13 CSS, 3 HTML)
Estimated Global Coverage: 95.2% of web audience

EFFECTIVE BROWSER FLOOR:
   Chrome 120+  |  Safari 17.2+  |  Firefox 121+  |  Edge 120+  |  iOS Safari 17.2+

ROOT CAUSE ANALYSIS:

1. Untranspiled Syntax Leaks (from packages/ui):
   ! packages/ui distributes modern JS with optional chaining (?.) and nullish
     coalescing (??) directly into dist/.
   -> Impact: Hard floor at Chrome 80+, Safari 13.1+, Firefox 74+.
   -> Action: Ensure packages/ui build pipeline targets ES2018 or downlevels syntax.

2. Native CSS Nesting without Fallback:
   ! Relaxed CSS nesting (&) detected in compiled component styles.
   -> Impact: Imposes Safari 17.2+ / Chrome 120+ for type selector nesting.
   -> Action: Add postcss-nested or @csstools/postcss-nesting in postcss.config.js.

3. Runtime Web APIs & Modern Selectors:
   ! structuredClone() used in state serialization (blocks Safari < 15.4).
   ! :has() selector used in card layouts (blocks Firefox < 121).
```

### CLI Terminal Output (`default`)

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                       COMPAT-AUDIT BUNDLE REPORT                          ║
╚═══════════════════════════════════════════════════════════════════════════╝

Scanned Directory: dist/
Assets Scanned:    38 files (24 JS, 11 CSS, 3 HTML)
Estimated Coverage: 95.1% global audience

EFFECTIVE BROWSER FLOOR (Minimum required versions):
   Chrome 105+  |  Safari 15.4+  |  Firefox 105+  |  Edge 105+  |  iOS Safari 15.4+  |  Chrome Android 105+

CONFIGURATION & BUNDLE DIAGNOSTICS:
   ! Syntax vs Runtime Gap: Your bundler targets 'es2020', but the bundle contains runtime Web APIs (structuredClone, ResizeObserver). Bundlers transpile JavaScript syntax (like arrow functions or classes) but DO NOT polyfill global runtime APIs without dedicated polyfills.
   ! CSS Nesting without fallback: Native CSS nesting (&) is emitted in your CSS bundle. Older browser engines (Safari < 16.5, Chrome < 112) will ignore these nested rules.

RECOMMENDED REMEDIATIONS (Polyfills & Configuration):
   ┌───────┬───────────────────────────────┬─────────────┬─────────────┬────────────────────────────────────────────────────────┐
   │ Level │ Feature                       │ Category    │ Est. Time   │ Recommended Action                                     │
   ├───────┼───────────────────────────────┼─────────────┼─────────────┼────────────────────────────────────────────────────────┤
   │   E1  │ structuredClone()             │ api         │ ~5 mins     │ Import @ungap/structured-clone (1.2KB) in entry        │
   │   E1  │ Array.prototype.at()          │ prototype   │ ~5 mins     │ Add tiny Array.prototype.at polyfill in entry          │
   │   E1  │ Object.hasOwn()               │ builtin     │ ~5 mins     │ Add tiny Object.hasOwn polyfill in entry               │
   │   E2  │ Native CSS Nesting (&)        │ selector    │ ~15 mins    │ Enable postcss-nested in postcss.config.js             │
   │   E2  │ OKLCH Colors                  │ css         │ ~15 mins    │ Add @csstools/postcss-oklab-function in PostCSS        │
   └───────┴───────────────────────────────┴─────────────┴─────────────┴────────────────────────────────────────────────────────┘
   Legend: E1 = Lightweight runtime polyfill (~5m) | E2 = Bundler/PostCSS transpile config (~15m)

ARCHITECTURAL CONSTRAINTS (Effort 3 & 4 - Requires Architectural Choice):
   • ResizeObserver (api.ResizeObserver) : Import resize-observer-polyfill (2.5KB gzip) dynamically if !window.ResizeObserver.
   • :has() selector (css.selectors.has) : Dynamic :has() cannot be polyfilled in CSS without heavy JS runtime selector engines. Use parent CSS class toggling in component state.

Run with --format json or --format markdown for CI/CD or PR integrations.
```

<details>
<summary><b>View CI / PR Markdown Report Format (<code>--markdown</code>)</b></summary>

```markdown
## Browser Compatibility Audit Report

- **Scanned Directory:** `dist/`
- **Total Files Scanned:** 38 (24 JS, 11 CSS, 3 HTML)
- **Estimated Global Coverage:** **95.1%**

### Effective Browser Floor
| Browser | Minimum Version Required |
|---|---|
| **Chrome** | `105+` |
| **Safari** | `15.4+` |
| **Firefox** | `105+` |
| **Edge** | `105+` |
| **iOS Safari** | `15.4+` |
| **Chrome Android** | `105+` |

### Configuration & Bundle Diagnostics
> [!WARNING] **Syntax vs Runtime Gap**: Your bundler targets 'es2020', but the bundle contains runtime Web APIs (structuredClone, ResizeObserver). Bundlers transpile JavaScript syntax (like arrow functions or classes) but DO NOT polyfill global runtime APIs without dedicated polyfills.
> [!WARNING] **CSS Nesting without fallback**: Native CSS nesting (&) is emitted in your CSS bundle. Older browser engines (Safari < 16.5, Chrome < 112) will ignore these nested rules.

### Actionable Remediations (Polyfills & Configuration)
| Effort Level | Feature | Category | Est. Time | Recommended Action |
|---|---|---|---|---|
| **E1** (Trivial Polyfill) | `structuredClone()` | api | ~5 mins | Import @ungap/structured-clone (1.2KB) in entry |
| **E1** (Trivial Polyfill) | `Array.prototype.at()` | prototype | ~5 mins | Add tiny Array.prototype.at polyfill in entry |
| **E1** (Trivial Polyfill) | `Object.hasOwn()` | builtin | ~5 mins | Add tiny Object.hasOwn polyfill in entry |
| **E2** (Configuration) | `Native CSS Nesting (&)` | selector | ~15 mins | Enable postcss-nested in postcss.config.js |
| **E2** (Configuration) | `OKLCH Colors` | css | ~15 mins | Add @csstools/postcss-oklab-function in PostCSS |

### Architectural Constraints (Effort 3 & 4)
- **ResizeObserver** (`api.ResizeObserver`): Import resize-observer-polyfill (2.5KB gzip) dynamically if !window.ResizeObserver.
- **:has() selector** (`css.selectors.has`): Dynamic :has() cannot be polyfilled in CSS without heavy JS runtime selector engines. Use parent CSS class toggling in component state.
```

</details>

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
