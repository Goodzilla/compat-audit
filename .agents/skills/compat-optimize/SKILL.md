---
name: compat-optimize
description: Interactively apply browser compatibility quick-wins (Effort 1 runtime polyfills & Effort 2 bundler/CSS configs) to reach older browsers with minimal effort. Use when user wants to optimize browser support or mentions "/compat-optimize".
disable-model-invocation: true
---

# /compat-optimize — Interactive Compatibility Optimizer

Interactively apply low-hanging fruit optimizations identified by `compat-audit` to reach older browser baselines with minimal effort, zero bloat, and full safety.

## Execution Rules
1. **NEVER run ad-hoc exploratory shell commands (`ls`, `cat`, `find`)**:
   Use native file reading tools (`view_file`) for config inspection.
2. **NEVER run ad-hoc inline Node scripts (`node -e '...'`)**:
   Never generate dynamic eval scripts. Use native file editing tools (`replace_file_content`, `write_to_file`) for code changes.
3. **Use canonical, prefix-matchable commands**:
   - `npx compat-audit --build --json` (or `node bin/compat-audit.js --build --json` inside this repository).
   - Standard build/test commands (`npm run build`, `npm test`).
4. **Confirm all changes**: Draft and present the exact diff before writing to disk.

---

## Interactive Workflow

### 1. Pre-flight & Current Audit State
1. Check `git status --porcelain`: Warn the user if uncommitted changes exist to ensure full rollback safety.
2. Run canonical audit: `npx compat-audit --build --json` and parse results in memory.

### 2. Baseline Alignment with the User
1. Scan for declared targets (`.browserslistrc`, `vite.config.*`, `tsconfig.json`) using `view_file`.
   - If present: Confirm if the user wants to eliminate the compatibility gap and match that target.
   - If absent: Suggest industry presets:
     - **Baseline Widely Available** (~98% coverage: Chrome 105+, Safari 15.4+, Firefox 105+).
     - **Enterprise / Conservative** (~99.5% coverage: Safari 14+, Chrome 90+, Firefox 91 ESR).
2. Group audit `quickWins` into Effort 1 (Micro-polyfills, ~5m) and Effort 2 (Bundler/CSS configs, ~15m).
3. Confirm the scope with the user (e.g. *Apply all Effort 1 + 2*, or *Effort 1 only*).

### 3. Draft Framework-Aware Code Modifications
Present proposed diffs before applying:
- **Effort 1 (Runtime micro-polyfills)**: Create dedicated `src/polyfills.ts` (or `.js`) with zero-dependency lightweight shims (<100B each, e.g. for `Array.prototype.at`, `Object.hasOwn`, or `@ungap/structured-clone`). Import it at line 1 of the detected framework entry (`src/main.ts`, `hooks.client.ts`, `app/layout.tsx`, etc.).
- **Effort 2 (Bundler/CSS configs)**: Update Vite/PostCSS/Webpack/Babel configuration (e.g., enable `postcss-nested` or downlevel target).

### 4. Apply Changes, Rebuild & Test
1. Apply modifications using file-editing tools.
2. Rebuild assets: `npm run build` (or detected PM).
3. If tests exist, run `npm test` to verify no regressions.
4. If build or tests fail, offer immediate rollback (`git restore .`).

### 5. Validate Improvement (Before vs After)
Re-run `npx compat-audit --build --json` and display:
- **Minimum Supported Version Delta**: Before vs After (e.g., *Safari 15.4+ -> Safari 14.1+*).
- **Audience Reach Gain**: Global coverage delta (e.g., *+3.4%*).
- **Bundle Weight Delta**: Added size overhead (e.g., *+0.9 KB gzip*).
