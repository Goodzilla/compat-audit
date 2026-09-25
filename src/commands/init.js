import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import pc from 'picocolors';

export const COMPAT_AUDIT_SKILL = `---
name: compat-audit
description: Audit production bundles (JS, CSS, HTML) in SPAs and monorepos to determine browser floors, detect target vs reality drift, trace internal library syntax leaks, and suggest fixes.
---

# Browser Compatibility Auditor (\`compat-audit\`)

Audit compiled production assets against MDN and CanIUse to determine real browser support floors, detect target-vs-reality drift, and identify quick-win optimizations.

## Execution Rules
1. **NEVER run ad-hoc inline Node scripts (\`node -e '...'\`)**:
   All AST parsing and CanIUse/MDN evaluations are built into \`compat-audit\`.
2. **ALWAYS use the canonical CLI command**:
   \`npx compat-audit <dir> --json\` (or \`node bin/compat-audit.js <dir> --json\` inside this repo).
3. **Parse JSON in memory**: Extract \`browserFloor\`, \`coverage\`, \`diagnostics\`, \`quickWins\`, and \`structuralBlockers\`.

---

## Audit Workflow

### 1. Target Discovery & Config Inspection
- Locate compiled assets: \`dist/\`, \`build/\`, \`.output/public/\`, \`.svelte-kit/output/client/\`, \`.next/static/\`. If missing, build first (\`npm run build\`).
- In monorepos (pnpm, Turborepo, Nx, npm workspaces), detect sub-packages (\`apps/*/dist\`, \`packages/*/dist\`).
- Inspect declared browser intent: \`.browserslistrc\`, \`package.json#browserslist\`, Vite \`build.target\`, or \`tsconfig.json\`.

### 2. Execution
Run canonical audit command per target:
\`\`\`bash
npx compat-audit dist/ --json
\`\`\`

### 3. Report Synthesis
Present results with clean, sober engineering analysis:

1. **Target vs Reality Matrix**:
   - Compare declared project target (e.g., Safari 14+, Chrome 90+) against actual bundle floor.
   - Highlight compatibility drift and audience coverage loss (e.g., *Drift: -3.2% global audience*).
2. **Monorepo & Internal Package Leakage**:
   - Flag if an internal shared library (e.g., \`packages/ui\`) is leaking untranspiled syntax (\`?.\`, \`??\`, private fields) or native CSS nesting into the client app bundle.
3. **Root Cause Technical Breakdown**:
   - Modern CSS (nesting, \`@container\`, \`oklch()\`).
   - Runtime Web APIs (\`structuredClone\`, \`ResizeObserver\`, \`Array.prototype.at\`).
4. **Remediation Plan by Effort Tier**:
   - Group by ROI: Effort 1 micro-polyfills (<1.5KB) vs Effort 2 bundler/PostCSS configs.

### 4. Next Step Recommendation
If actionable quick wins exist (Effort 1 or 2), recommend the companion interactive optimizer:
> *"Run \`/compat-optimize\` to interactively apply these quick-win polyfills or bundler adjustments and verify the improved browser coverage."*
`;

export const COMPAT_OPTIMIZE_SKILL = `---
name: compat-optimize
description: Interactively apply browser compatibility quick-wins (Effort 1 runtime polyfills & Effort 2 bundler/CSS configs) to reach older browsers with minimal effort. Use when user wants to optimize browser support or mentions "/compat-optimize".
disable-model-invocation: true
---

# /compat-optimize — Interactive Compatibility Optimizer

Interactively apply low-hanging fruit optimizations identified by \`compat-audit\` to reach older browser baselines with minimal effort, zero bloat, and full safety.

## Execution Rules
1. **NEVER run ad-hoc inline Node scripts (\`node -e '...'\`)**:
   Never generate dynamic eval scripts. Use native file tools (\`replace_file_content\`, \`write_to_file\`) for code changes.
2. **Use canonical, prefix-matchable commands**:
   - \`npx compat-audit <dir> --json\` (or \`node bin/compat-audit.js <dir> --json\` inside this repo).
   - Standard build/test commands (\`npm run build\`, \`npm test\`).
3. **Confirm all changes**: Draft and present the exact diff before writing to disk.

---

## Interactive Workflow

### 1. Pre-flight & Current Audit State
1. Check \`git status --porcelain\`: Warn the user if uncommitted changes exist to ensure full rollback safety.
2. Ensure assets exist (run \`npm run build\` or detected PM: \`pnpm\`, \`yarn\`, \`bun\` if needed).
3. Run \`npx compat-audit dist/ --json\` and parse results in memory.

### 2. Baseline Alignment with the User
1. Scan for declared targets (\`.browserslistrc\`, \`vite.config.*\`, \`tsconfig.json\`).
   - If present: Confirm if the user wants to eliminate the drift and match that target.
   - If absent: Suggest industry presets:
     - **Baseline Widely Available** (~98% coverage: Chrome 105+, Safari 15.4+, Firefox 105+).
     - **Enterprise / Conservative** (~99.5% coverage: Safari 14+, Chrome 90+, Firefox 91 ESR).
2. Group audit \`quickWins\` into Effort 1 (Micro-polyfills, ~5m) and Effort 2 (Bundler/CSS configs, ~15m).
3. Confirm the scope with the user (e.g. *Apply all Effort 1 + 2*, or *Effort 1 only*).

### 3. Draft Framework-Aware Code Modifications
Present proposed diffs before applying:
- **Effort 1 (Runtime micro-polyfills)**: Create dedicated \`src/polyfills.ts\` (or \`.js\`) with zero-dependency lightweight shims (<100B each, e.g. for \`Array.prototype.at\`, \`Object.hasOwn\`, or \`@ungap/structured-clone\`). Import it at line 1 of the detected framework entry (\`src/main.ts\`, \`hooks.client.ts\`, \`app/layout.tsx\`, etc.).
- **Effort 2 (Bundler/CSS configs)**: Update Vite/PostCSS/Webpack/Babel configuration (e.g., enable \`postcss-nested\` or downlevel target).

### 4. Apply Changes, Rebuild & Test
1. Apply modifications using file-editing tools.
2. Rebuild assets: \`npm run build\`.
3. If tests exist, run \`npm test\` to verify no regressions.
4. If build or tests fail, offer immediate rollback (\`git restore .\`).

### 5. Validate Improvement (Before vs After)
Re-run \`npx compat-audit dist/ --json\` and display:
- **Browser Floor Delta**: Before vs After (e.g., *Safari 15.4+ -> Safari 14.1+*).
- **Audience Reach Gain**: Global coverage delta (e.g., *+3.4%*).
- **Bundle Weight Delta**: Added size overhead (e.g., *+0.9 KB gzip*).
`;

/**
 * Scaffolds AI agent skills into local workspace or global agent directory
 */
export function initSkills(options = {}) {
  const isGlobal = Boolean(options.global);
  const baseDir = isGlobal
    ? path.join(os.homedir(), '.gemini', 'config', 'skills')
    : path.resolve(options.cwd || process.cwd(), '.agents', 'skills');

  const auditSkillDir = path.join(baseDir, 'compat-audit');
  const optimizeSkillDir = path.join(baseDir, 'compat-optimize');

  fs.mkdirSync(auditSkillDir, { recursive: true });
  fs.mkdirSync(optimizeSkillDir, { recursive: true });

  const auditPath = path.join(auditSkillDir, 'SKILL.md');
  const optimizePath = path.join(optimizeSkillDir, 'SKILL.md');

  fs.writeFileSync(auditPath, COMPAT_AUDIT_SKILL, 'utf-8');
  fs.writeFileSync(optimizePath, COMPAT_OPTIMIZE_SKILL, 'utf-8');

  return {
    isGlobal,
    baseDir,
    filesCreated: [auditPath, optimizePath]
  };
}
