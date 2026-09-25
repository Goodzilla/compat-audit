---
name: compat-audit
description: Audit production bundles (JS, CSS, HTML) in SPAs and monorepos to determine browser floors, detect target vs reality drift, trace internal library syntax leaks, and suggest fixes.
---

# Browser Compatibility Auditor (`compat-audit`)

Audit compiled production assets against MDN and CanIUse to determine real browser support floors, detect target-vs-reality drift, and identify quick-win optimizations.

## Execution Rules
1. **NEVER run ad-hoc inline Node scripts (`node -e '...'`)**:
   All AST parsing and CanIUse/MDN evaluations are built into `compat-audit`.
2. **ALWAYS use the canonical CLI command**:
   `npx compat-audit <dir> --json` (or `node bin/compat-audit.js <dir> --json` inside this repo).
3. **Parse JSON in memory**: Extract `browserFloor`, `coverage`, `diagnostics`, `quickWins`, and `structuralBlockers`.

---

## Audit Workflow

### 1. Target Discovery & Config Inspection
- Locate compiled assets: `dist/`, `build/`, `.output/public/`, `.svelte-kit/output/client/`, `.next/static/`. If missing, build first (`npm run build`).
- In monorepos (pnpm, Turborepo, Nx, npm workspaces), detect sub-packages (`apps/*/dist`, `packages/*/dist`).
- Inspect declared browser intent: `.browserslistrc`, `package.json#browserslist`, Vite `build.target`, or `tsconfig.json`.

### 2. Execution
Run canonical audit command per target:
```bash
npx compat-audit dist/ --json
```

### 3. Report Synthesis
Present results with clean, sober engineering analysis:

1. **Target vs Reality Matrix**:
   - Compare declared project target (e.g., Safari 14+, Chrome 90+) against actual bundle floor.
   - Highlight compatibility drift and audience coverage loss (e.g., *Drift: -3.2% global audience*).
2. **Monorepo & Internal Package Leakage**:
   - Flag if an internal shared library (e.g., `packages/ui`) is leaking untranspiled syntax (`?.`, `??`, private fields) or native CSS nesting into the client app bundle.
3. **Root Cause Technical Breakdown**:
   - Modern CSS (nesting, `@container`, `oklch()`).
   - Runtime Web APIs (`structuredClone`, `ResizeObserver`, `Array.prototype.at`).
4. **Remediation Plan by Effort Tier**:
   - Group by ROI: Effort 1 micro-polyfills (<1.5KB) vs Effort 2 bundler/PostCSS configs.

### 4. Next Step Recommendation
If actionable quick wins exist (Effort 1 or 2), recommend the companion interactive optimizer:
> *"Run `/compat-optimize` to interactively apply these quick-win polyfills or bundler adjustments and verify the improved browser coverage."*
