---
name: compat-optimize
description: Interactively apply browser compatibility quick-wins (runtime polyfills and bundler/CSS configs) to resolve compatibility gaps with zero bloat.
disable-model-invocation: true
allowed-tools:
  - run_command
  - view_file
  - replace_file_content
  - write_to_file
  - Bash
  - ReadFile
  - EditFile
  - WriteFile
---

# Interactive Compatibility Optimizer (`compat-optimize`)

Apply high-ROI compatibility fixes identified by `compat-audit` to eliminate browser gaps with zero external package bloat, graceful degradation, and single-turn delivery.

## Execution Rules
- **Reuse Context First**: If an audit exists in conversation history, reuse its findings and targets immediately. Do not trigger a redundant rebuild unless requested.
- **Hybrid Approach First**: Prioritize bundler downleveling (`vite.config.*` target) and PostCSS transforms (`postcss-preset-env`) over JavaScript shims.
- **Zero Repo Pollution**: Do not run `npm install` / `pnpm add` for Effort 1 micro-polyfills. Create clean, audited inline shims in `src/polyfills.ts`.
- **Graceful Degradation for CSS**: Never remove modern CSS features. Provide standard fallback declarations before modern values, add `-webkit-` vendor prefixes, and use `@supports`.
- **Single-Turn Proposal**: Draft and apply all necessary file modifications in Turn 1 without multi-turn questioning.

## Remediation Playbook

### 1. Bundler & PostCSS Config (Effort 2)
- **Nesting**: If native CSS nesting (`&`) is emitted without fallback, add `postcss-preset-env` or `postcss-nested` in `postcss.config.js`.
- **Syntax Target**: Lower `build.target` in `vite.config.ts` (e.g. `'es2020'`) to eliminate untranspiled syntax leaks.

### 2. Zero-Dependency Runtime Shims (Effort 1: `src/polyfills.ts`)
Create `src/polyfills.ts` (or `.js`) containing only the necessary shims guarded with `if (!...)`:
- **`Object.hasOwn`**: Fallback to `Object.prototype.hasOwnProperty.call(obj, prop)`.
- **`Array.prototype.at`**: Implement on `Array`, `String`, and `Object.getPrototypeOf(Uint8Array).prototype`.
- **`Promise.allSettled` / `withResolvers`**: Minimal inline Promise wrappers.
- **`crypto.randomUUID`**: RFC 4122 v4 generator using `crypto.getRandomValues()`.
- **`structuredClone`**: Recursive deep-clone using `WeakMap` for circular references, supporting `Date`, `RegExp`, `Map`, `Set`, `ArrayBuffer`, and `TypedArray`. Recommend `@ungap/structured-clone` only if complex DOM types (`Blob`, `ImageBitmap`) are required.

### 3. CSS Progressive Enhancement (Effort 1 & 2)
- **Dynamic Viewports**: Precede `100dvh` with `100vh` fallback; use `@supports (height: 100dvh)`.
- **Safari Prefixes**: Prepend `-webkit-backdrop-filter`, `-webkit-appearance: none`, `-webkit-line-clamp`.
- **Flex Aspect Ratio**: Add `min-width: 0; min-height: 0;` to flex items with `aspect-ratio`.

## Workflow
1. **Identify Gaps**: Extract targets and missing features from context or `npx compat-audit --build --json`.
2. **Apply Fixes**: Create `src/polyfills.ts` (if runtime APIs missing) and update relevant config/styles.
3. **Wire Entry**: Add `import './polyfills';` at line 1 of app entry point (`src/main.ts`, `src/index.ts`, `src/routes/+layout.svelte`, etc.).
4. **Verify**: Run `npx compat-audit --build --json` and present the complete Before vs After compatibility matrix with audience gain metrics.
