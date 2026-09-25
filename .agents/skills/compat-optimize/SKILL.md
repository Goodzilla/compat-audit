---
name: compat-optimize
description: Interactively apply browser compatibility quick-wins (Effort 1 runtime polyfills & Effort 2 bundler/CSS configs) to reach older browsers with minimal effort. Use when user wants to optimize browser support or mentions "/compat-optimize".
disable-model-invocation: true
---

# /compat-optimize — Senior Interactive Compatibility Optimizer

Apply high-ROI browser compatibility remediations identified by `compat-audit` to eliminate compatibility gaps with zero bloat, zero repository pollution, and 1-turn turnaround.

## Execution Rules
1. **REUSE CONTEXT FIRST (No redundant audits)**:
   If an audit was already performed earlier in the conversation, **DO NOT run a new build or audit**. Directly reuse the existing findings, targets, and `quickWins` from the context history.
   Only run `npx compat-audit --build --json` if no audit data exists in the conversation or if the user explicitly requests a fresh re-scan.
2. **ZERO REPO POLLUTION (NEVER run package installs)**:
   **NEVER execute `npm install`, `pnpm add`, or `yarn add`**.
   Never install external packages for Effort 1 micro-polyfills. External installs pollute the project tree (e.g. creating unwanted `.pnpm-store` folders) and bloat dependencies. All micro-polyfills MUST be 100% inline zero-dependency vanilla shims.
3. **NO AD-HOC EXPLORATORY SHELL COMMANDS**:
   Never run `ls`, `cat`, or `find`. Use native file tools (`view_file`, `replace_file_content`, `write_to_file`).
4. **1-TURN DETERMINISTIC PROPOSAL**:
   Do not initiate multiple round-trips asking questions. Formulate the optimal unified diff immediately in Turn 1 and present it clearly to the user.

---

## Interactive Workflow

### 1. Context Extraction or Fresh Audit
- **Scenario A (Audit already in context)**:
  Extract the declared targets, limiting browsers, and `quickWins` list directly from previous messages. Proceed immediately to Step 2.
- **Scenario B (No audit in context)**:
  Run `npx compat-audit --build --json` once and parse results in memory.

### 2. Formulate Single-Shot Solution
Select remedies based on detected gaps:

#### Effort 1: Zero-Dependency Polyfill Cookbook (`src/polyfills.ts` or `.js`)
When missing global APIs are detected, create `src/polyfills.ts` using exclusively these audited inline implementations:

```typescript
// src/polyfills.ts — Zero-dependency compatibility shims (<300B total)

// 1. Object.hasOwn (Chrome < 93, Safari < 15.4, Firefox < 92)
if (!Object.hasOwn) {
  Object.hasOwn = (obj: object, prop: PropertyKey) =>
    Object.prototype.hasOwnProperty.call(obj, prop);
}

// 2. Array/String.prototype.at (Chrome < 92, Safari < 15.4, Firefox < 90)
function at(this: any, n: number) {
  n = Math.trunc(n) || 0;
  if (n < 0) n += this.length;
  if (n < 0 || n >= this.length) return undefined;
  return this[n];
}
for (const C of [Array, String, typeof Uint8Array !== 'undefined' ? Uint8Array : null].filter(Boolean)) {
  if (!C!.prototype.at) (C!.prototype as any).at = at;
}

// 3. Promise.allSettled (Chrome < 76, Safari < 13, Firefox < 71)
if (!Promise.allSettled) {
  Promise.allSettled = (promises: Promise<any>[]) =>
    Promise.all(promises.map(p =>
      Promise.resolve(p).then(
        value => ({ status: 'fulfilled', value }),
        reason => ({ status: 'rejected', reason })
      )
    ));
}

// 4. crypto.randomUUID (Chrome < 92, Safari < 15.4, Firefox < 95)
if (typeof crypto !== 'undefined' && !crypto.randomUUID) {
  crypto.randomUUID = (() => {
    return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c: any) =>
      (+c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))).toString(16)
    ) as any;
  }) as any;
}

// 5. structuredClone fallback (Chrome < 98, Safari < 15.4, Firefox < 94)
if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = function <T>(val: T): T {
    return JSON.parse(JSON.stringify(val));
  };
}
```

#### Effort 2: Bundler / CSS Adjustments
- **CSS Nesting**: Add `postcss-preset-env` or `postcss-nested` into `postcss.config.js`.
- **Syntax Downleveling**: Update target in `vite.config.ts` (e.g. `build: { target: 'es2020' }`).

### 3. Application & Entry Wiring
1. Detect framework entry file (`src/main.ts`, `src/main.tsx`, `src/index.ts`, `src/app.tsx`, `src/routes/+layout.svelte`).
2. Add `import './polyfills';` at line 1.
3. Write or update files using `write_to_file` or `replace_file_content`.

### 4. Build & Verify
1. Re-run `npx compat-audit --build --json` to verify the gap closure.
2. Present the Before vs After delta:
   - **Minimum Supported Version Delta**: (e.g., *Safari 15.4+ -> Safari 13.0+*).
   - **Audience Reach Gain**: Global coverage delta (e.g., *+3.2% global audience reach*).
   - **Bundle Weight Overhead**: Zero npm packages added, ~250 bytes gzip.
