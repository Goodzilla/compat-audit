import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import pc from 'picocolors';

export const COMPAT_AUDIT_SKILL = "---\nname: compat-audit\ndescription: Audit production bundles (JS, CSS, HTML) in SPAs and monorepos to determine browser floors, detect target vs reality drift, trace internal library syntax leaks, and suggest fixes.\n---\n\n# Browser Compatibility Auditor (`compat-audit`)\n\nAudit compiled production assets against MDN and CanIUse to determine real minimum supported browser versions, detect compatibility gaps against declared targets, and identify quick-win optimizations.\n\n## Execution Rules\n1. **NEVER run ad-hoc exploratory shell commands (`ls`, `cat`, `find`, etc.)**:\n   Use native file reading tools (`view_file`) to inspect `package.json`, `tsconfig.json`, or bundler configs. Running exploratory terminal commands causes unnecessary authorization friction.\n2. **NEVER run ad-hoc inline Node scripts (`node -e '...'`)**:\n   All AST parsing and CanIUse/MDN evaluations are built directly into `compat-audit`.\n3. **ALWAYS force fresh build with `--build`**:\n   `npx compat-audit --build --json` (or `node bin/compat-audit.js --build --json` inside this repository).\n   The `--build` flag forces an unconditional fresh build using the detected package manager, guaranteeing that audits never evaluate stale build output.\n4. **Parse JSON in memory**: Extract `verdict`, `hasGaps`, `coverage`, `audienceLoss`, `browserSummary`, `diagnostics`, `quickWins`, and `structuralBlockers`.\n\n---\n\n## Audit Workflow\n\n### 1. Configuration Inspection\n- Use native file tools (`view_file`) to check declared intent: `package.json`, `tsconfig.json`, `vite.config.*`, or `.browserslistrc`.\n- Do not run manual shell discovery.\n\n### 2. Execution\nRun the canonical audit command (forces fresh build + scans in 1 step):\n```bash\nnpx compat-audit --build --json\n```\n\n### 3. Report Synthesis\nPresent results strictly following this 4-section adaptive structure using sober engineering analysis and standard English terminology:\n\n#### 1. Executive Summary\n- **Verdict**: Display clear verdict badge: **COMPLIANT** (if zero compatibility gaps) or **COMPATIBILITY GAP DETECTED**.\n- **Metrics**:\n  - Scanned Directory & Asset count (JS, CSS, HTML).\n  - Estimated Global Coverage (`XX.X%`).\n  - Compatibility Gap (`0%` if compliant, or `-X.X% global audience loss`).\n\n#### 2. Browser Compatibility Summary\nRender the markdown table:\n| Platform | Environment | Declared Target | Minimum Supported Version | Status & Headroom |\n|---|---|---|---|---|\n| Desktop | Chrome / Chromium | `ES2015` | `Chrome 51+` | ✅ Compliant (+39 versions headroom, down to v51+) |\n| Desktop | Safari / WebKit | `ES2015` | `Safari 10+` | ✅ Compliant (+4 versions headroom, down to v10+) |\n| Desktop | Firefox / Gecko | `ES2015` | `Firefox 54+` | ✅ Compliant (Supported down to v54+) |\n| Desktop | Edge | `ES2015` | `Edge 15+` | ✅ Compliant (Supported down to v15+) |\n| Mobile | iOS Safari | `ES2015` | `iOS 10+` | ✅ Compliant (+4 versions headroom, down to v10+) |\n| Mobile | Chrome Android | `ES2015` | `Chrome 51+` | ✅ Compliant (+39 versions headroom, down to v51+) |\n| Mobile | Samsung Internet | `ES2015` | `Samsung 5.0+` | ✅ Compliant (Supported down to v5.0+) |\n\n*Never output `all` (e.g. `Chrome all`); always report the concrete minimum supported version supporting the detected baseline.*\n\n#### 3. Diagnostics & Code Findings *(Render only if issues exist)*\n- **Source Attribution**: Distinguish whether modern syntax/APIs originate from application code vs 3rd-party vendor dependencies (`origin: 'vendor'`).\n- **Monorepo / Shared Package Leakage**: Internal libraries leaking untranspiled syntax (`?.`, `??`, private fields) or native CSS nesting.\n- **Runtime Web APIs without polyfills**: APIs like `structuredClone`, `ResizeObserver`, or `Array.prototype.at`.\n- **Safari & WebKit Visual Quirks**: Missing `-webkit-backdrop-filter`, `100vh` viewport clipping on iOS Safari, flexbox `aspect-ratio` layout blowout, sticky clip traps, un-prefixed line-clamp or form controls.\n\n#### 4. Actionable Remediation Plan\n- **When Compliant**: Keep concise: *\"No remediation required. Bundle meets or exceeds all declared targets.\"*\n- **When Gaps Exist**: Group actionable quick wins:\n  - **Effort 1 (Micro-polyfills, ~5m)**: Lightweight runtime shims (<1.5KB).\n  - **Effort 2 (Bundler/PostCSS, ~15m)**: Build configuration adjustments.\n  - **Architectural Constraints (Effort 3 & 4)**: Foundational choices (e.g., native `:has()`).\n\n### 4. Next Step Recommendation\nIf actionable quick wins exist (Effort 1 or 2), recommend the companion interactive optimizer:\n> *\"Run `/compat-optimize` to interactively apply these quick-win polyfills or bundler adjustments and verify the improved browser coverage.\"*\n";

export const COMPAT_OPTIMIZE_SKILL = "---\nname: compat-optimize\ndescription: Interactively apply browser compatibility quick-wins (Effort 1 runtime polyfills & Effort 2 bundler/CSS configs) to reach older browsers with minimal effort. Use when user wants to optimize browser support or mentions \"/compat-optimize\".\ndisable-model-invocation: true\n---\n\n# /compat-optimize — Senior Interactive Compatibility Optimizer\n\nApply high-ROI browser compatibility remediations identified by `compat-audit` to eliminate compatibility gaps with zero bloat, zero repository pollution, graceful degradation, and 1-turn turnaround.\n\n## Execution Rules\n1. **REUSE CONTEXT FIRST (No redundant audits)**:\n   If an audit was already performed earlier in the conversation, **DO NOT run a new build or audit**. Directly reuse the existing findings, targets, and `quickWins` from the context history.\n   Only run `npx compat-audit --build --json` if no audit data exists in the conversation or if the user explicitly requests a fresh re-scan.\n2. **ZERO REPO POLLUTION (NEVER run package installs)**:\n   **NEVER execute `npm install`, `pnpm add`, or `yarn add`**.\n   Never install external packages for Effort 1 micro-polyfills. External installs pollute the project tree (e.g. creating unwanted `.pnpm-store` folders) and bloat dependencies. All micro-polyfills MUST be 100% inline zero-dependency vanilla shims.\n3. **ALWAYS ATTEMPT GRACEFUL DEGRADATION FIRST**:\n   **NEVER destructively strip or replace modern features with obsolete legacy code**. Always favor progressive enhancement:\n   - **CSS**: Prioritize `@supports (property: value)` and `@supports selector(...)`. Provide standard fallback declarations immediately before modern properties (e.g. solid color fallback before `color-mix()` / `oklch()`, `100vh` before `100dvh`). Add standard WebKit vendor prefixes (`-webkit-backdrop-filter`, `-webkit-appearance: none`, `-webkit-line-clamp`).\n   - **JS**: Use non-destructive capability guards (`if (!globalThis.foo)`) and non-polluting shims that preserve native performance in modern browsers while safely running on older ones.\n4. **NO AD-HOC EXPLORATORY SHELL COMMANDS**:\n   Never run `ls`, `cat`, or `find`. Use native file tools (`view_file`, `replace_file_content`, `write_to_file`).\n5. **1-TURN DETERMINISTIC PROPOSAL**:\n   Do not initiate multiple round-trips asking questions. Formulate the optimal unified diff immediately in Turn 1 and present it clearly to the user.\n\n---\n\n## Interactive Workflow\n\n### 1. Context Extraction or Fresh Audit\n- **Scenario A (Audit already in context)**:\n  Extract the declared targets, limiting browsers, and `quickWins` list directly from previous messages. Proceed immediately to Step 2.\n- **Scenario B (No audit in context)**:\n  Run `npx compat-audit --build --json` once and parse results in memory.\n\n### 2. Formulate Single-Shot Solution\nSelect remedies based on detected gaps:\n\n#### Effort 1: Zero-Dependency Polyfill Cookbook (`src/polyfills.ts` or `.js`)\nWhen missing global APIs are detected, create `src/polyfills.ts` using exclusively these audited inline implementations:\n\n```typescript\n// src/polyfills.ts — Zero-dependency compatibility shims (<300B total)\n\n// 1. Object.hasOwn (Chrome < 93, Safari < 15.4, Firefox < 92)\nif (!Object.hasOwn) {\n  Object.hasOwn = (obj: object, prop: PropertyKey) =>\n    Object.prototype.hasOwnProperty.call(obj, prop);\n}\n\n// 2. Array/String.prototype.at (Chrome < 92, Safari < 15.4, Firefox < 90)\nfunction at(this: any, n: number) {\n  n = Math.trunc(n) || 0;\n  if (n < 0) n += this.length;\n  if (n < 0 || n >= this.length) return undefined;\n  return this[n];\n}\nfor (const C of [Array, String, typeof Uint8Array !== 'undefined' ? Uint8Array : null].filter(Boolean)) {\n  if (!C!.prototype.at) (C!.prototype as any).at = at;\n}\n\n// 3. Promise.allSettled (Chrome < 76, Safari < 13, Firefox < 71)\nif (!Promise.allSettled) {\n  Promise.allSettled = (promises: Promise<any>[]) =>\n    Promise.all(promises.map(p =>\n      Promise.resolve(p).then(\n        value => ({ status: 'fulfilled', value }),\n        reason => ({ status: 'rejected', reason })\n      )\n    ));\n}\n\n// 4. crypto.randomUUID (Chrome < 92, Safari < 15.4, Firefox < 95)\nif (typeof crypto !== 'undefined' && !crypto.randomUUID) {\n  crypto.randomUUID = (() => {\n    return '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c: any) =>\n      (+c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (+c / 4)))).toString(16)\n    ) as any;\n  }) as any;\n}\n\n// 5. structuredClone fallback (Chrome < 98, Safari < 15.4, Firefox < 94)\nif (typeof globalThis.structuredClone !== 'function') {\n  globalThis.structuredClone = function <T>(val: T): T {\n    return JSON.parse(JSON.stringify(val));\n  };\n}\n\n// 6. Promise.withResolvers (Chrome < 119, Safari < 17.4, Firefox < 121)\nif (!Promise.withResolvers) {\n  Promise.withResolvers = function <T>() {\n    let resolve!: (value: T | PromiseLike<T>) => void;\n    let reject!: (reason?: any) => void;\n    const promise = new Promise<T>((res, rej) => {\n      resolve = res;\n      reject = rej;\n    });\n    return { promise, resolve, reject };\n  };\n}\n\n// 7. Object.groupBy / Map.groupBy (Chrome < 117, Safari < 17.4, Firefox < 119)\nif (!Object.groupBy) {\n  Object.groupBy = <T, K extends PropertyKey>(items: Iterable<T>, callback: (item: T, index: number) => K): Partial<Record<K, T[]>> => {\n    const result = Object.create(null);\n    let i = 0;\n    for (const item of items) {\n      const key = callback(item, i++);\n      (result[key] || (result[key] = [])).push(item);\n    }\n    return result;\n  };\n}\n```\n\n#### Effort 2: Graceful Degradation & CSS Progressive Enhancement Cookbook\nAlways prefer progressive enhancement patterns (`@supports`, double declarations, and WebKit vendor prefixes) over removing modern design:\n\n```css\n/* 1. Dynamic Viewport (100dvh) with standard 100vh fallback for older Safari/iOS */\n.hero {\n  min-height: 100vh; /* Fallback for Safari < 15.4 */\n}\n@supports (min-height: 100dvh) {\n  .hero {\n    min-height: 100dvh; /* Seamless handling for mobile address bars */\n  }\n}\n\n/* 2. Backdrop Filter (Safari < 18 requires -webkit- prefix) */\n.glassmorphism {\n  -webkit-backdrop-filter: blur(12px); /* Safari / WebKit */\n  backdrop-filter: blur(12px);\n}\n\n/* 3. Modern Color Functions (color-mix / oklch) */\n.accent {\n  background-color: #3b82f6; /* Fallback solid color */\n  background-color: color-mix(in srgb, var(--primary) 80%, white);\n}\n\n/* 4. Multi-line Text Truncation (WebKit line-clamp recipe) */\n.truncate-multiline {\n  overflow: hidden;\n  display: -webkit-box;\n  -webkit-box-orient: vertical;\n  -webkit-line-clamp: 3;\n  line-clamp: 3;\n}\n\n/* 5. Custom Form Controls without iOS native overrides */\ninput.custom, select.custom, button.custom {\n  -webkit-appearance: none;\n  appearance: none;\n}\n\n/* 6. Aspect-ratio in Flexbox items (prevents Safari layout blowout) */\n.flex-item-with-ratio {\n  min-width: 0;\n  min-height: 0;\n  aspect-ratio: 16 / 9;\n}\n\n/* 7. Mobile root landscape text scaling */\nhtml {\n  -webkit-text-size-adjust: 100%;\n  text-size-adjust: 100%;\n}\n```\n\n- **CSS Nesting**: Add `postcss-preset-env` or `postcss-nested` into `postcss.config.js`.\n- **Syntax Downleveling**: Update target in `vite.config.ts` (e.g. `build: { target: 'es2020' }`).\n\n### 3. Application & Entry Wiring\n1. Detect framework entry file (`src/main.ts`, `src/main.tsx`, `src/index.ts`, `src/app.tsx`, `src/routes/+layout.svelte`).\n2. Add `import './polyfills';` at line 1.\n3. Apply CSS graceful degradation and `@supports` additions into relevant stylesheet(s).\n4. Write or update files using `write_to_file` or `replace_file_content`.\n\n### 4. Build & Verify\n1. Re-run `npx compat-audit --build --json` to verify the gap closure.\n2. Present the **Complete Updated Browser Compatibility Table** covering all target platforms and browsers:\n\n```markdown\n### Complete Browser Compatibility Matrix (Before vs After)\n\n| Platform | Environment | Declared Target | Before | After (Optimized) | Status & Gain |\n|---|---|---|---|---|---|\n| Desktop | Chrome / Chromium | `ES2015` | `Chrome 98+` | `Chrome 51+` | ✅ Compliant (+47 versions gain) |\n| Desktop | Safari / WebKit | `ES2015` | `Safari 18+` | `Safari 10+` | ✅ Compliant (+8 versions gain) |\n| Desktop | Firefox / Gecko | `ES2015` | `Firefox 94+` | `Firefox 54+` | ✅ Compliant (+40 versions gain) |\n| Desktop | Edge | `ES2015` | `Edge 98+` | `Edge 15+` | ✅ Compliant (+83 versions gain) |\n| Mobile | iOS Safari | `ES2015` | `iOS 18+` | `iOS 10+` | ✅ Compliant (+8 versions gain) |\n| Mobile | Chrome Android | `ES2015` | `Chrome 98+` | `Chrome 51+` | ✅ Compliant (+47 versions gain) |\n| Mobile | Samsung Internet | `ES2015` | `Samsung 17+` | `Samsung 5.0+` | ✅ Compliant (+12 versions gain) |\n```\n\n3. Summarize final impact metrics:\n   - **Audience Reach Gain**: Global coverage delta (e.g. `92.1% -> 99.4% (+7.3% audience reach)`).\n   - **Safari Visual Stability**: All WebKit specific prefixes and fallback viewports verified.\n   - **Bundle Weight Overhead**: Zero external npm dependencies added, minimal gzip footprint (<350 bytes).\n";

import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

/**
 * Interactively prompt the user for installation scope if running in a TTY
 */
export async function promptScope() {
  if (!process.stdin.isTTY) {
    return 'local';
  }

  const rl = readline.createInterface({ input, output });
  console.log('');
  console.log('Where would you like to install the AI agent skills?');
  console.log('  1) Project workspace (.agents/skills/ + .claude/ bridge - recommended)');
  console.log('  2) Global (machine-wide for Claude Code, Codex, Antigravity, Cursor, Zed, OpenCode)');
  console.log('');

  try {
    const answer = await rl.question('Select an option (1-2) [default: 1]: ');
    rl.close();
    const trimmed = answer.trim();
    if (trimmed === '2' || trimmed.toLowerCase() === 'global' || trimmed.toLowerCase() === 'g') {
      return 'global';
    }
    return 'local';
  } catch {
    rl.close();
    return 'local';
  }
}

function writeSkillsTo(baseDir, filesCreated) {
  const auditSkillDir = path.join(baseDir, 'compat-audit');
  const optimizeSkillDir = path.join(baseDir, 'compat-optimize');

  fs.mkdirSync(auditSkillDir, { recursive: true });
  fs.mkdirSync(optimizeSkillDir, { recursive: true });

  const auditPath = path.join(auditSkillDir, 'SKILL.md');
  const optimizePath = path.join(optimizeSkillDir, 'SKILL.md');

  fs.writeFileSync(auditPath, COMPAT_AUDIT_SKILL, 'utf-8');
  fs.writeFileSync(optimizePath, COMPAT_OPTIMIZE_SKILL, 'utf-8');

  filesCreated.push(auditPath, optimizePath);
}

function bridgeSkills(sourceBaseDir, targetBaseDir, filesCreated, isRelative = false) {
  try {
    fs.mkdirSync(targetBaseDir, { recursive: true });
    for (const skillName of ['compat-audit', 'compat-optimize']) {
      const targetDir = path.join(targetBaseDir, skillName);
      const sourceDir = path.join(sourceBaseDir, skillName);

      try {
        if (fs.existsSync(targetDir)) {
          const stat = fs.lstatSync(targetDir);
          if (stat.isSymbolicLink() || stat.isDirectory()) {
            fs.rmSync(targetDir, { recursive: true, force: true });
          }
        }
        const linkTarget = isRelative
          ? path.relative(targetBaseDir, sourceDir)
          : sourceDir;

        const symlinkType = process.platform === 'win32' ? 'junction' : 'dir';
        fs.symlinkSync(linkTarget, targetDir, symlinkType);
        filesCreated.push(path.join(targetDir, 'SKILL.md'));
      } catch {
        // Fallback to copy if symlinks not supported
        fs.mkdirSync(targetDir, { recursive: true });
        const targetFile = path.join(targetDir, 'SKILL.md');
        const sourceFile = path.join(sourceDir, 'SKILL.md');
        if (fs.existsSync(sourceFile)) {
          fs.copyFileSync(sourceFile, targetFile);
          filesCreated.push(targetFile);
        }
      }
    }
  } catch {}
}

/**
 * Scaffolds AI agent skills into local workspace or global agent directories
 * supporting all major AI agent harnesses (Claude Code, Codex, Antigravity, Cursor, Zed, OpenCode, Copilot, Windsurf)
 */
export function initSkills(options = {}) {
  const isGlobal = Boolean(options.global);
  const filesCreated = [];
  const harnessesSupported = [];

  if (isGlobal) {
    const homeDir = options.homeDir || os.homedir();

    // 1. Universal Agent Standard: ~/.agents/skills/ (Codex, OpenCode, Cursor, Zed, Aider)
    const homeAgents = path.join(homeDir, '.agents', 'skills');
    writeSkillsTo(homeAgents, filesCreated);
    harnessesSupported.push('Universal Agent Standard (~/.agents/skills/)');

    // 2. Claude Code global: ~/.claude/skills/
    const homeClaude = path.join(homeDir, '.claude', 'skills');
    bridgeSkills(homeAgents, homeClaude, filesCreated);
    harnessesSupported.push('Claude Code (~/.claude/skills/)');

    // 3. Google Antigravity global: ~/.gemini/config/skills/
    const homeGemini = path.join(homeDir, '.gemini', 'config', 'skills');
    bridgeSkills(homeAgents, homeGemini, filesCreated);
    harnessesSupported.push('Google Antigravity (~/.gemini/config/skills/)');
  } else {
    const projectRoot = options.cwd || process.cwd();

    // 1. Universal Agent Standard: .agents/skills/ (Antigravity, Codex, Zed, OpenCode)
    const agentsDir = path.join(projectRoot, '.agents', 'skills');
    writeSkillsTo(agentsDir, filesCreated);
    harnessesSupported.push('Universal Agent Standard (.agents/skills/)');

    // 2. Claude Code workspace bridge: .claude/skills/
    const claudeDir = path.join(projectRoot, '.claude', 'skills');
    bridgeSkills(agentsDir, claudeDir, filesCreated, true);
    harnessesSupported.push('Claude Code (.claude/skills/)');

    // 3. Cursor rules bridge: .cursor/rules/compat.mdc
    try {
      const cursorDir = path.join(projectRoot, '.cursor', 'rules');
      fs.mkdirSync(cursorDir, { recursive: true });
      const cursorFile = path.join(cursorDir, 'compat.mdc');
      fs.writeFileSync(cursorFile, `---
description: Browser compatibility auditing and zero-bloat optimization
globs: *
---

# Browser Compatibility Rules

- Audit bundle floor: Run \`npx compat-audit --build --json\` to detect real browser floors and compatibility gaps.
- Optimize compatibility: Run \`/compat-optimize\` or inspect \`.agents/skills/compat-optimize/SKILL.md\` for zero-dependency inline polyfills.
`, 'utf-8');
      filesCreated.push(cursorFile);
      harnessesSupported.push('Cursor (.cursor/rules/compat.mdc)');
    } catch {}

    // 4. GitHub Copilot bridge: .github/copilot-instructions.md
    try {
      const githubDir = path.join(projectRoot, '.github');
      fs.mkdirSync(githubDir, { recursive: true });
      const copilotFile = path.join(githubDir, 'copilot-instructions.md');
      const instructionText = `\n## Browser Compatibility Guidelines\n- Run \`npx compat-audit --build --json\` to audit production bundle compatibility.\n- For missing Web APIs (structuredClone, Array.at, Object.hasOwn), use zero-dependency inline polyfills in \`src/polyfills.ts\` without installing external packages.\n`;
      if (fs.existsSync(copilotFile)) {
        const existing = fs.readFileSync(copilotFile, 'utf-8');
        if (!existing.includes('compat-audit')) {
          fs.appendFileSync(copilotFile, instructionText);
        }
      } else {
        fs.writeFileSync(copilotFile, instructionText.trim() + '\n', 'utf-8');
      }
      filesCreated.push(copilotFile);
      harnessesSupported.push('GitHub Copilot (.github/copilot-instructions.md)');
    } catch {}
  }

  return {
    isGlobal,
    harnessesSupported,
    filesCreated
  };
}


