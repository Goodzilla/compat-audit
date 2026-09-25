---
name: compat-audit
description: Audit production bundles (JS, CSS, HTML) in SPAs and monorepos to determine minimum browser version floors, detect syntax leaks, and identify actionable polyfills or config fixes.
---

# Browser Compatibility Auditor (`compat-audit`)

Use this skill whenever auditing browser compatibility for compiled frontend bundles, determining minimum browser support floors across Chrome, Safari, Firefox, and Edge, or finding remediations for older browser support.

## Critical Rules for Agent Execution

1. **NEVER run ad-hoc inline Node scripts (`node -e '...'`)**:
   Do NOT generate disposable inline node scripts or custom bash AST parsers. All Acorn AST traversal, CSSTree inspections, and MDN / CanIUse matrix evaluations are natively built into `compat-audit`.
2. **ALWAYS use the canonical CLI command**:
   Execute:
   ```bash
   npx compat-audit <dir> --json
   ```
   *(or `node bin/compat-audit.js <dir> --json` if executing inside the `compat-audit` repository)*.
   Using standard command prefixes allows the user's IDE to auto-approve commands with a single click, completely eliminating repetitive permission popups.
3. **Analyze the JSON payload in memory**:
   The `--json` output returns the entire audit in a single step:
   - `browserFloor`: Minimum required version for each monitored browser.
   - `coverage`: Estimated global audience percentage.
   - `diagnostics`: Configuration vs bundle gap analyses (e.g., transpiler target vs runtime Web APIs, unconfigured CSS nesting).
   - `quickWins`: Prioritized fixes for Effort 1 (trivial polyfills) and Effort 2 (bundler / PostCSS configuration).
   - `structuralBlockers`: Effort 3 & 4 items requiring architectural decisions (e.g., `:has()`, `@container`).

---

## Audit Procedure

### 1. Target Discovery
Locate compiled asset directories containing `.js`, `.css`, or `.html` files:
- Single applications: `dist/`, `build/`, `.output/public/`, `.svelte-kit/output/client/`, `.next/static/`
- Monorepos: inspect sub-packages such as `apps/*/dist` and `packages/*/dist`

If build artifacts are absent, run or request the project build step (`npm run build`) first.

### 2. Execution
Run `compat-audit` against each target directory with `--json`:
```bash
npx compat-audit dist/ --json
```

For monorepos, iterate through each compiled package target:
```bash
npx compat-audit apps/web/dist --json
npx compat-audit packages/ui/dist --json
```

### 3. Report Synthesis
Present results with clean, sober engineering analysis:

1. **Browser Floor Summary Table**:
   - Monitored targets (Application, UI packages, docs).
   - Browser minimum versions (Chrome, Safari macOS/iOS, Firefox, Edge).
   - Estimated global audience coverage.
   - Primary limiting factors.

2. **Root Cause Technical Breakdown**:
   - **Syntax Leaks**: Untranspiled syntax (e.g. `?.`, `??`, private class fields) leaking from internal libraries into `dist/`.
   - **Modern CSS**: Native nesting (`&`), modern color spaces (`oklch()`, `color-mix()`), container queries.
   - **Runtime Web APIs**: Unpolyfilled globals (`structuredClone()`, `crypto.randomUUID()`, `ResizeObserver`, `Array.prototype.at()`).

3. **Remediation Plan**:
   Group recommendations by effort tier (e.g. 5-minute polyfills in entry vs 15-minute PostCSS configuration changes).

### 4. Next Step Recommendation
If actionable quick wins exist (Effort 1 or Effort 2), suggest the companion interactive optimization skill:
> *"Run `/compat-optimize` to interactively apply these quick-win polyfills or bundler adjustments and verify the improved browser coverage."*

