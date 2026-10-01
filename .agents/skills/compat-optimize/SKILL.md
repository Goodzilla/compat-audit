---
name: compat-optimize
description: Interactively diagnose and apply senior-grade compatibility remediations (bundler downleveling, zero-bloat inline shims, and CSS fallbacks) with false-positive verification and interactive decision prompts.
disable-model-invocation: true
allowed-tools:
  - run_command
  - view_file
  - replace_file_content
  - write_to_file
  - ask_question
  - Bash
  - ReadFile
  - EditFile
  - WriteFile
---

# Senior Compatibility Optimizer (`compat-optimize`)

Diagnose and remediate browser compatibility gaps identified by `compat-audit` with the rigor of a Senior Web Platform Engineer: verify root causes, separate application code from third-party vendor leaks, reject naive fake polyfills, arbitrate architectural trade-offs with the developer via interactive modals (`ask_question`), and verify post-fix coverage.

## Core Philosophy
1. **Root Cause Over Patching**: Fix syntax gaps at the bundler/transpiler level (`vite.config.*`, `tsconfig.json`, SWC/Babel). Never attempt runtime polyfilling for syntax errors (`SyntaxError`).
2. **App Code vs Vendor Leaks**:
   - If an issue originates from application source code (`src/`): refactor directly or provide targeted shims.
   - If an issue leaks from a dependency in `node_modules/`: configure the bundler to transpile that package (e.g. Vite `optimizeDeps`, Babel `include`, SWC) or inject a guarded global runtime shim before the vendor code executes.
3. **No Naive "Fake" Polyfills**:
   - For simple prototypes/APIs (`Array.at`, `Object.hasOwn`, `Promise.withResolvers`, `crypto.randomUUID`): use zero-dependency inline shims (< 300 bytes) guarded by `if (!...)`.
   - For complex specs (`structuredClone`, `ResizeObserver`, `IntersectionObserver`): NEVER hand-roll incomplete deep-clone or observer functions. Prompt the developer to choose between an audited micro-package (e.g. `@ungap/structured-clone`, 1.2KB) or a clean application refactor.
4. **Interactive Trade-off Arbitration**: When multiple valid solutions exist (e.g. micro-package vs JSON refactor, dynamic import vs static shim), use `ask_question` to let the developer decide.
5. **Progressive CSS Enhancement**: Never replace modern CSS with heavy JavaScript layout engines. Use dual declarations (`100vh` + `100dvh`), `-webkit-` vendor prefixes, flex blowout guards (`min-width: 0`), and `@supports`.

---

## 4-Phase Optimization Workflow

### Phase 1: Context & False-Positive Inspection
1. **Reuse or Extract Findings**: Retrieve compatibility issues from recent conversation context, or run `npx compat-audit --build --json` (or `node bin/compat-audit.js --build --json`).
2. **Contextual Inspection (Anti-False-Positive)**:
   - Check source code or source maps for flagged symbols.
   - For prototype methods (`.at()`, `.groupBy()`): verify if they are invoked on genuine built-in types (`Array`, `String`, `TypedArray`) rather than domain models or collections with homonymous methods.
   - For modern syntax (`?.`, `??`, `??=`): identify which file and package emitted the syntax. If already handled by a downstream polyfill service or conditional feature test, mark as safe.

### Phase 2: Root-Cause Remediation Tree

#### Category A: Modern Syntax (BLOCKING - `SyntaxError`)
- **Root Cause**: Bundler target configured too high (e.g. `esnext`, `es2022`) or third-party package published as modern ESM without transpilation.
- **Remediation**:
  - Update bundler target in `vite.config.*` / `tsconfig.json` (e.g. `build: { target: 'es2020' }` or downlevel to match declared target).
  - If leaking from `node_modules`, configure bundler transpilation for the offending package.

#### Category B: Lightweight Built-ins & Prototypes (< 300B)
- **APIs**: `Object.hasOwn`, `Array.prototype.at`, `Promise.withResolvers`, `crypto.randomUUID`, `Object.groupBy`.
- **Remediation**: Generate clean, guarded inline shims in `src/polyfills.ts` (or `src/polyfills.js`):
  ```typescript
  // Object.hasOwn
  if (typeof Object.hasOwn !== 'function') {
    Object.hasOwn = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop);
  }

  // Array.prototype.at
  if (!Array.prototype.at) {
    const at = function(n) {
      n = Math.trunc(n) || 0;
      if (n < 0) n += this.length;
      if (n < 0 || n >= this.length) return undefined;
      return this[n];
    };
    Array.prototype.at = at;
    String.prototype.at = at;
    if (typeof TypedArray !== 'undefined') {
      TypedArray.prototype.at = at;
    }
  }

  // Promise.withResolvers
  if (!Promise.withResolvers) {
    Promise.withResolvers = function() {
      let resolve, reject;
      const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
      });
      return { promise, resolve, reject };
    };
  }

  // crypto.randomUUID
  if (typeof crypto !== 'undefined' && !crypto.randomUUID) {
    crypto.randomUUID = function() {
      return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, c =>
        (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
      );
    };
  }
  ```

#### Category C: Complex Web APIs (Prompt Developer via `ask_question`)
- **`structuredClone`**:
  - Use `ask_question` with options:
    - `(Recommended) Install @ungap/structured-clone (1.2KB gzip) for complete spec compliance (Map, Set, ArrayBuffer, circular references)`
    - `Refactor app code to JSON.parse(JSON.stringify(dto)) if cloning only plain serializable objects`
    - `Add audited inline deep-clone shim in src/polyfills.ts (handles POJOs, Arrays, Dates, RegExps and circular refs)`
- **`ResizeObserver` / `IntersectionObserver`**:
  - Use `ask_question` with options:
    - `(Recommended) Dynamically import micro-polyfill only when window observer is missing`
    - `Refactor component to standard scroll / window resize listener`

#### Category D: CSS Progressive Enhancement (MEDIUM / LOW)
- **Vendor Prefixes**: Prepend `-webkit-backdrop-filter`, `-webkit-appearance: none`, `-webkit-line-clamp`.
- **Viewport Fallbacks**: Precede `100dvh` with `100vh` fallback:
  ```css
  height: 100vh;
  height: 100dvh;
  ```
- **Flexbox WebKit Blowout**: Add `min-width: 0; min-height: 0;` to flex items with `aspect-ratio`.
- **CSS Nesting**: Add `postcss-preset-env` or `postcss-nested` in `postcss.config.js`.

---

### Phase 3: Implementation & Entry Wiring
1. **Create or Update `src/polyfills.ts`**: Write strictly guarded shims.
2. **Wire Entry Point**: Import `src/polyfills.ts` on line 1 of the application entry point:
   - Vite / React / Vue / Vanilla: `src/main.ts` or `src/index.ts`
   - SvelteKit: `src/routes/+layout.svelte` or `src/hooks.client.ts`
   - Next.js: `app/layout.tsx` or `pages/_app.tsx`
   - Nuxt: `plugins/polyfills.client.ts`
3. **Update Configs**: Apply changes to `vite.config.*`, `tsconfig.json`, or PostCSS configs.

---

### Phase 4: Before vs After Verification Matrix
1. **Re-run Audit**: Execute `npx compat-audit --build --json` (or `node bin/compat-audit.js --build --json`).
2. **Present Verification Matrix**:
   Format the outcome in a clean, professional markdown table:

| Metric | Before Optimization | After Optimization | Delta / Status |
| :--- | :--- | :--- | :--- |
| **Target Coverage %** | `88.4%` | `98.6%` | `+10.2%` |
| **Audience Gap %** | `11.6%` | `1.4%` | `-10.2%` (Recovered) |
| **Blocking Issues** | `2` | `0` | `-2` (Resolved) |
| **High Issues** | `1` | `0` | `-1` (Resolved) |
| **Medium / Low Issues** | `3` | `0` | `-3` (Resolved) |
| **Estimated Bundle Impact** | - | `+0.4 KB` | Negligible |

3. **Detail Remaining Items**: If any gap remains (e.g. deliberate trade-off on an obsolete browser version), document why and how it degrades gracefully.
