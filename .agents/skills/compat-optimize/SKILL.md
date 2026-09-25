---
name: compat-optimize
description: Interactively apply browser compatibility quick-wins (Effort 1 runtime polyfills & Effort 2 bundler/CSS configs) to reach older browsers with minimal effort. Use when user wants to optimize browser support or mentions "/compat-optimize".
disable-model-invocation: true
---

# /compat-optimize — Senior Interactive Compatibility Optimizer

Apply high-ROI browser compatibility remediations identified by `compat-audit` to eliminate compatibility gaps with zero bloat, zero repository pollution, graceful degradation, and 1-turn turnaround.

## Execution Rules
1. **REUSE CONTEXT FIRST (No redundant audits)**:
   If an audit was already performed earlier in the conversation, **DO NOT run a new build or audit**. Directly reuse the existing findings, targets, and `quickWins` from the context history.
   Only run `npx compat-audit --build --json` if no audit data exists in the conversation or if the user explicitly requests a fresh re-scan.
2. **ZERO REPO POLLUTION (NEVER run package installs)**:
   **NEVER execute `npm install`, `pnpm add`, or `yarn add`**.
   Never install external packages for Effort 1 micro-polyfills. External installs pollute the project tree (e.g. creating unwanted `.pnpm-store` folders) and bloat dependencies. All micro-polyfills MUST be 100% inline zero-dependency vanilla shims.
3. **ALWAYS ATTEMPT GRACEFUL DEGRADATION FIRST**:
   **NEVER destructively strip or replace modern features with obsolete legacy code**. Always favor progressive enhancement:
   - **CSS**: Prioritize `@supports (property: value)` and `@supports selector(...)`. Provide standard fallback declarations immediately before modern properties (e.g. solid color fallback before `color-mix()` / `oklch()`, `100vh` before `100dvh`). Add standard WebKit vendor prefixes (`-webkit-backdrop-filter`, `-webkit-appearance: none`, `-webkit-line-clamp`).
   - **JS**: Use non-destructive capability guards (`if (!globalThis.foo)`) and non-polluting shims that preserve native performance in modern browsers while safely running on older ones.
4. **NO AD-HOC EXPLORATORY SHELL COMMANDS**:
   Never run `ls`, `cat`, or `find`. Use native file tools (`view_file`, `replace_file_content`, `write_to_file`).
5. **1-TURN DETERMINISTIC PROPOSAL**:
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

// 6. Promise.withResolvers (Chrome < 119, Safari < 17.4, Firefox < 121)
if (!Promise.withResolvers) {
  Promise.withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: any) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

// 7. Object.groupBy / Map.groupBy (Chrome < 117, Safari < 17.4, Firefox < 119)
if (!Object.groupBy) {
  Object.groupBy = <T, K extends PropertyKey>(items: Iterable<T>, callback: (item: T, index: number) => K): Partial<Record<K, T[]>> => {
    const result = Object.create(null);
    let i = 0;
    for (const item of items) {
      const key = callback(item, i++);
      (result[key] || (result[key] = [])).push(item);
    }
    return result;
  };
}
```

#### Effort 2: Graceful Degradation & CSS Progressive Enhancement Cookbook
Always prefer progressive enhancement patterns (`@supports`, double declarations, and WebKit vendor prefixes) over removing modern design:

```css
/* 1. Dynamic Viewport (100dvh) with standard 100vh fallback for older Safari/iOS */
.hero {
  min-height: 100vh; /* Fallback for Safari < 15.4 */
}
@supports (min-height: 100dvh) {
  .hero {
    min-height: 100dvh; /* Seamless handling for mobile address bars */
  }
}

/* 2. Backdrop Filter (Safari < 18 requires -webkit- prefix) */
.glassmorphism {
  -webkit-backdrop-filter: blur(12px); /* Safari / WebKit */
  backdrop-filter: blur(12px);
}

/* 3. Modern Color Functions (color-mix / oklch) */
.accent {
  background-color: #3b82f6; /* Fallback solid color */
  background-color: color-mix(in srgb, var(--primary) 80%, white);
}

/* 4. Multi-line Text Truncation (WebKit line-clamp recipe) */
.truncate-multiline {
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 3;
  line-clamp: 3;
}

/* 5. Custom Form Controls without iOS native overrides */
input.custom, select.custom, button.custom {
  -webkit-appearance: none;
  appearance: none;
}

/* 6. Aspect-ratio in Flexbox items (prevents Safari layout blowout) */
.flex-item-with-ratio {
  min-width: 0;
  min-height: 0;
  aspect-ratio: 16 / 9;
}

/* 7. Mobile root landscape text scaling */
html {
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}
```

- **CSS Nesting**: Add `postcss-preset-env` or `postcss-nested` into `postcss.config.js`.
- **Syntax Downleveling**: Update target in `vite.config.ts` (e.g. `build: { target: 'es2020' }`).

### 3. Application & Entry Wiring
1. Detect framework entry file (`src/main.ts`, `src/main.tsx`, `src/index.ts`, `src/app.tsx`, `src/routes/+layout.svelte`).
2. Add `import './polyfills';` at line 1.
3. Apply CSS graceful degradation and `@supports` additions into relevant stylesheet(s).
4. Write or update files using `write_to_file` or `replace_file_content`.

### 4. Build & Verify
1. Re-run `npx compat-audit --build --json` to verify the gap closure.
2. Present the **Complete Updated Browser Compatibility Table** covering all target platforms and browsers:

```markdown
### Complete Browser Compatibility Matrix (Before vs After)

| Platform | Environment | Declared Target | Before | After (Optimized) | Status & Gain |
|---|---|---|---|---|---|
| Desktop | Chrome / Chromium | `ES2015` | `Chrome 98+` | `Chrome 51+` | ✅ Compliant (+47 versions gain) |
| Desktop | Safari / WebKit | `ES2015` | `Safari 18+` | `Safari 10+` | ✅ Compliant (+8 versions gain) |
| Desktop | Firefox / Gecko | `ES2015` | `Firefox 94+` | `Firefox 54+` | ✅ Compliant (+40 versions gain) |
| Desktop | Edge | `ES2015` | `Edge 98+` | `Edge 15+` | ✅ Compliant (+83 versions gain) |
| Mobile | iOS Safari | `ES2015` | `iOS 18+` | `iOS 10+` | ✅ Compliant (+8 versions gain) |
| Mobile | Chrome Android | `ES2015` | `Chrome 98+` | `Chrome 51+` | ✅ Compliant (+47 versions gain) |
| Mobile | Samsung Internet | `ES2015` | `Samsung 17+` | `Samsung 5.0+` | ✅ Compliant (+12 versions gain) |
```

3. Summarize final impact metrics:
   - **Audience Reach Gain**: Global coverage delta (e.g. `92.1% -> 99.4% (+7.3% audience reach)`).
   - **Safari Visual Stability**: All WebKit specific prefixes and fallback viewports verified.
   - **Bundle Weight Overhead**: Zero external npm dependencies added, minimal gzip footprint (<350 bytes).
