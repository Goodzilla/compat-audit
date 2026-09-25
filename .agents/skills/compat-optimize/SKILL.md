---
name: compat-optimize
description: Interactively apply browser compatibility quick-wins (Effort 1 runtime polyfills & Effort 2 bundler/CSS configs) to reach older browsers with minimal effort. Use when user wants to optimize browser support or mentions "/compat-optimize".
disable-model-invocation: true
---

# /compat-optimize — Interactive Compatibility Optimizer

Apply low-hanging fruit optimizations identified by `compat-audit` to unlock older browser versions with minimal developer effort and zero unnecessary bundle overhead.

---

## Critical Rules for Agent Execution

1. **NEVER run ad-hoc inline Node scripts (`node -e '...'`)**:
   Do NOT generate disposable inline node scripts or bash eval pipelines to patch code, inject polyfills, or parse ASTs. Inline commands change dynamically on every invocation, defeating IDE permission auto-approval and generating repetitive permission popups.
2. **ALWAYS use standard file-editing tools**:
   Use native file editing tools (`replace_file_content` / `write_to_file`) to apply polyfill imports, modify entry files, or update bundler configurations.
3. **ALWAYS use canonical CLI commands**:
   - Run `npx compat-audit <dir> --json` (or `node bin/compat-audit.js <dir> --json` inside this repository) to inspect the audit state before and after optimization.
   - Run standard build commands (`npm run build`, `pnpm build`, `yarn build`, or `bun run build`). Standard commands can be approved once by the user.
4. **Always confirm changes before editing**:
   Draft the exact modifications and present them clearly to the user before modifying any source or configuration files.

---

## Interactive Workflow

### Step 1: Gather Current Audit State
Check for compiled assets (`dist/`, `build/`, `.svelte-kit/output/client/`, `.next/static/`, `.output/public/`). If absent or outdated, build the project first:
```bash
npm run build
```
*(Use the project's detected package manager: `pnpm build`, `yarn build`, or `bun run build`).*

Execute the canonical audit command:
```bash
npx compat-audit dist/ --json
```
Parse the JSON response in memory to extract `browserFloor`, `coverage`, and `quickWins`.

### Step 2: Review and Select Scope with the User
Present the available quick wins from the audit report grouped by effort tier:

- **Effort 1: Trivial Runtime Micro-polyfills (~5 mins)**
  - Targets: `Array.prototype.at`, `Object.hasOwn`, `Promise.allSettled`, `Promise.any`, `String.prototype.replaceAll`, `structuredClone`, `crypto.randomUUID`.
  - Bundle cost: Typically < 1.5 KB total gzip.
  - Integration: Client entry file or a dedicated `src/polyfills.ts` / `src/polyfills.js` loaded at bootstrap.
- **Effort 2: Bundler & CSS Transformations (~15 mins)**
  - Targets: Syntax downleveling (optional chaining, nullish coalescing, logical assignment) or CSS transforms (`postcss-nested`, `@csstools/postcss-oklab-function`, `postcss-preset-env`).
  - Integration: `vite.config.*`, `webpack.config.*`, `postcss.config.*`, or `package.json#browserslist`.

Prompt the user to confirm the desired remediation scope:
1. **Apply all Effort 1 + Effort 2 fixes** (Recommended: Maximum compatibility gain for minimal effort).
2. **Effort 1 only** (Micro-polyfills only, zero bundler changes).
3. **Target a specific browser version** (e.g., "Bring Safari floor down to Safari 14+").

### Step 3: Draft Proposed Modifications
Display the exact proposed changes to the user before touching any files:
- **Polyfill strategy**: Show the code snippet to be added to the client entry point or helper module.
- **Configuration strategy**: Show the exact diff for Vite, PostCSS, Webpack, or Babel configuration.

### Step 4: Apply Changes & Rebuild
Once the user confirms:
1. Apply changes using `write_to_file` or `replace_file_content`.
2. Run the build command to produce fresh assets:
   ```bash
   npm run build
   ```

### Step 5: Validate Improvement (Before vs After)
Re-run the audit:
```bash
npx compat-audit dist/ --json
```
Present a clean comparison summary:
- **Browser Floor Delta**: Compare previous minimums against new minimums (e.g. *Safari 15.4+ ➔ Safari 14.1+*).
- **Audience Reach Delta**: Population gain (e.g. *94.8% ➔ 98.4% (+3.6%)*).
- **Bundle Weight Delta**: Added polyfill overhead (e.g. *+1.1 KB gzip*).
