import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import pc from 'picocolors';

export const COMPAT_AUDIT_SKILL = "---\nname: compat-audit\ndescription: Audit production bundles (JS, CSS, HTML) in SPAs and monorepos to determine browser support floors, detect target vs reality drift, trace internal library syntax leaks, and suggest fixes.\nallowed-tools:\n  - run_command\n  - view_file\n  - Bash\n  - ReadFile\n---\n\n# Browser Compatibility Auditor (`compat-audit`)\n\nAudit compiled production assets against MDN and Can I Use data to detect browser compatibility floors, gaps against declared targets, and quick-win optimizations.\n\n## Guardrails\n- **No exploratory shell commands**: Never run `ls`, `cat`, or `find`. Inspect configs (`package.json`, `tsconfig.json`, `vite.config.*`) using `view_file` / `ReadFile`.\n- **No ad-hoc inline Node scripts**: NEVER run ad-hoc inline Node scripts (`node -e '...'`). All AST parsing and Can I Use evaluations are handled internally by `compat-audit`.\n- **Always build fresh**: Run `npx compat-audit --build --json` (or `node bin/compat-audit.js --build --json`) to avoid auditing stale assets.\n\n## Execution Steps\n1. **Inspect Intent**: Read declared targets from `package.json`, `tsconfig.json`, `vite.config.*`, or `.browserslistrc`.\n2. **Run Audit**: Execute `npx compat-audit --build --json` and parse the output JSON into memory.\n3. **Report Results**: Present a clean 4-section report using standard English engineering terms:\n   - **Executive Summary**: Verdict badge (`COMPLIANT` or `COMPATIBILITY GAP DETECTED`), asset counts, global coverage %, and gap %.\n   - **Browser Summary Table**: Columns: `Platform | Environment | Declared Target | Minimum Supported Version | Status & Headroom`. Cover Desktop (Chrome, Safari, Firefox, Edge) and Mobile (iOS Safari, Chrome Android, Samsung Internet).\n   - **Diagnostics**: Detail source origin (`app` vs `vendor` packages via source maps), syntax vs runtime gaps, and WebKit visual quirks. Only render if issues exist.\n   - **Remediation Plan**: Group actionable items by effort tier:\n     - *Effort 1 (Micro-polyfills, ~5m)*: Inline zero-dependency runtime shims.\n     - *Effort 2 (Bundler/PostCSS, ~15m)*: Target adjustments or PostCSS plugins.\n     - *Effort 3 & 4 (Architectural)*: Heavier polyfills or layout constraints.\n4. **Next Step**: If Effort 1 or 2 quick wins exist, prompt:\n   > *\"Run `/compat-optimize` to interactively apply these quick wins and verify improved browser coverage.\"*\n";

export const COMPAT_OPTIMIZE_SKILL = "---\nname: compat-optimize\ndescription: Interactively apply browser compatibility quick-wins (runtime polyfills and bundler/CSS configs) to resolve compatibility gaps with zero bloat.\ndisable-model-invocation: true\nallowed-tools:\n  - run_command\n  - view_file\n  - replace_file_content\n  - write_to_file\n  - Bash\n  - ReadFile\n  - EditFile\n  - WriteFile\n---\n\n# Interactive Compatibility Optimizer (`compat-optimize`)\n\nApply high-ROI compatibility fixes identified by `compat-audit` to eliminate browser gaps with zero external package bloat, graceful degradation, and single-turn delivery.\n\n## Execution Rules\n- **Reuse Context First**: If an audit exists in conversation history, reuse its findings and targets immediately. Do not trigger a redundant rebuild unless requested.\n- **Hybrid Approach First**: Prioritize bundler downleveling (`vite.config.*` target) and PostCSS transforms (`postcss-preset-env`) over JavaScript shims.\n- **Zero Repo Pollution**: Do not run `npm install` / `pnpm add` for Effort 1 micro-polyfills. Create clean, audited inline shims in `src/polyfills.ts`.\n- **Graceful Degradation for CSS**: Never remove modern CSS features. Provide standard fallback declarations before modern values, add `-webkit-` vendor prefixes, and use `@supports`.\n- **Single-Turn Proposal**: Draft and apply all necessary file modifications in Turn 1 without multi-turn questioning.\n\n## Remediation Playbook\n\n### 1. Bundler & PostCSS Config (Effort 2)\n- **Nesting**: If native CSS nesting (`&`) is emitted without fallback, add `postcss-preset-env` or `postcss-nested` in `postcss.config.js`.\n- **Syntax Target**: Lower `build.target` in `vite.config.ts` (e.g. `'es2020'`) to eliminate untranspiled syntax leaks.\n\n### 2. Zero-Dependency Runtime Shims (Effort 1: `src/polyfills.ts`)\nCreate `src/polyfills.ts` (or `.js`) containing only the necessary shims guarded with `if (!...)`:\n- **`Object.hasOwn`**: Fallback to `Object.prototype.hasOwnProperty.call(obj, prop)`.\n- **`Array.prototype.at`**: Implement on `Array`, `String`, and `Object.getPrototypeOf(Uint8Array).prototype`.\n- **`Promise.allSettled` / `withResolvers`**: Minimal inline Promise wrappers.\n- **`crypto.randomUUID`**: RFC 4122 v4 generator using `crypto.getRandomValues()`.\n- **`structuredClone`**: Recursive deep-clone using `WeakMap` for circular references, supporting `Date`, `RegExp`, `Map`, `Set`, `ArrayBuffer`, and `TypedArray`. Recommend `@ungap/structured-clone` only if complex DOM types (`Blob`, `ImageBitmap`) are required.\n\n### 3. CSS Progressive Enhancement (Effort 1 & 2)\n- **Dynamic Viewports**: Precede `100dvh` with `100vh` fallback; use `@supports (height: 100dvh)`.\n- **Safari Prefixes**: Prepend `-webkit-backdrop-filter`, `-webkit-appearance: none`, `-webkit-line-clamp`.\n- **Flex Aspect Ratio**: Add `min-width: 0; min-height: 0;` to flex items with `aspect-ratio`.\n\n## Workflow\n1. **Identify Gaps**: Extract targets and missing features from context or `npx compat-audit --build --json`.\n2. **Apply Fixes**: Create `src/polyfills.ts` (if runtime APIs missing) and update relevant config/styles.\n3. **Wire Entry**: Add `import './polyfills';` at line 1 of app entry point (`src/main.ts`, `src/index.ts`, `src/routes/+layout.svelte`, etc.).\n4. **Verify**: Run `npx compat-audit --build --json` and present the complete Before vs After compatibility matrix with audience gain metrics.\n";

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


