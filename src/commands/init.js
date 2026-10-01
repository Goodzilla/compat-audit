import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import pc from 'picocolors';

export const COMPAT_AUDIT_SKILL = "---\nname: compat-audit\ndescription: Audit production bundles (JS, CSS, HTML) in SPAs and monorepos to determine browser support floors, detect target vs reality drift, trace internal library syntax leaks, and suggest fixes.\nallowed-tools:\n  - run_command\n  - view_file\n  - Bash\n  - ReadFile\n---\n\n# Browser Compatibility Auditor (`compat-audit`)\n\nAudit compiled production assets against MDN and Can I Use data to detect browser compatibility floors, gaps against declared targets, and severity-classified breaking impacts.\n\n## Guardrails\n- **No exploratory shell commands**: Never run `ls`, `cat`, or `find`. Inspect configs (`package.json`, `tsconfig.json`, `vite.config.*`) using `view_file` / `ReadFile`.\n- **No ad-hoc inline Node scripts**: NEVER run ad-hoc inline Node scripts (`node -e '...'`). All AST parsing and Can I Use evaluations are handled internally by `compat-audit`.\n- **Always build fresh**: Run `npx compat-audit --build --json` (or `node bin/compat-audit.js --build --json`) to avoid auditing stale assets.\n\n## Execution Steps\n1. **Inspect Intent**: Read declared targets from `package.json`, `tsconfig.json`, `vite.config.*`, or `.browserslistrc`.\n2. **Run Audit**: Execute `npx compat-audit --build --json` and parse the output JSON into memory.\n3. **Report Results**: Present a clean 4-section report using standard English engineering terms:\n   - **Executive Summary**: Verdict badge (`COMPLIANT` or `COMPATIBILITY GAP DETECTED`), asset counts, Target Coverage %, Measured Coverage %, and Audience Gap %.\n   - **Browser Summary Table**: Columns: `Platform | Environment | Declared Target | Minimum Supported Version | Status & Headroom`. Cover Desktop (Chrome, Safari, Firefox, Edge) and Mobile (iOS Safari, Chrome Android, Samsung Internet).\n   - **Diagnostics**: Detail source origin (`app` vs `vendor` packages via source maps), syntax vs runtime gaps, and WebKit visual quirks. Only render if issues exist.\n   - **Compatibility Issues & Breaking Impacts**: Table listing detected compatibility gaps classified by CI/Sec severity level (`BLOCKING`, `HIGH`, `MEDIUM`, `LOW`):\n     - Columns: `Severity | Feature | Impact / Error Type | Broken Browsers | Audience Loss`\n     - *Blocking*: SyntaxError (script parse failure) or TypeError (prototype method missing).\n     - *High*: ReferenceError (missing global Web API).\n     - *Medium*: Ignored CSS layout, selector or property.\n     - *Low*: Missing vendor prefix (-webkit-) or viewport styling quirk.\n4. **Next Step**: If compatibility issues exist, prompt:\n   > *\"Run `/compat-optimize` to interactively resolve these compatibility issues and verify improved browser coverage.\"*\n";

export const COMPAT_OPTIMIZE_SKILL = "---\nname: compat-optimize\ndescription: Interactively diagnose and apply senior-grade compatibility remediations (bundler downleveling, zero-bloat inline shims, and CSS fallbacks) with false-positive verification and interactive decision prompts.\ndisable-model-invocation: true\nallowed-tools:\n  - run_command\n  - view_file\n  - replace_file_content\n  - write_to_file\n  - ask_question\n  - Bash\n  - ReadFile\n  - EditFile\n  - WriteFile\n---\n\n# Senior Compatibility Optimizer (`compat-optimize`)\n\nDiagnose and remediate browser compatibility gaps identified by `compat-audit` with the rigor of a Senior Web Platform Engineer: verify root causes, separate application code from third-party vendor leaks, reject naive fake polyfills, arbitrate architectural trade-offs with the developer via interactive modals (`ask_question`), and verify post-fix coverage.\n\n## Core Philosophy\n1. **Root Cause Over Patching**: Fix syntax gaps at the bundler/transpiler level (`vite.config.*`, `tsconfig.json`, SWC/Babel). Never attempt runtime polyfilling for syntax errors (`SyntaxError`).\n2. **App Code vs Vendor Leaks**:\n   - If an issue originates from application source code (`src/`): refactor directly or provide targeted shims.\n   - If an issue leaks from a dependency in `node_modules/`: configure the bundler to transpile that package (e.g. Vite `optimizeDeps`, Babel `include`, SWC) or inject a guarded global runtime shim before the vendor code executes.\n3. **No Naive \"Fake\" Polyfills**:\n   - For simple prototypes/APIs (`Array.at`, `Object.hasOwn`, `Promise.withResolvers`, `crypto.randomUUID`): use zero-dependency inline shims (< 300 bytes) guarded by `if (!...)`.\n   - For complex specs (`structuredClone`, `ResizeObserver`, `IntersectionObserver`): NEVER hand-roll incomplete deep-clone or observer functions. Prompt the developer to choose between an audited micro-package (e.g. `@ungap/structured-clone`, 1.2KB) or a clean application refactor.\n4. **Interactive Trade-off Arbitration**: When multiple valid solutions exist (e.g. micro-package vs JSON refactor, dynamic import vs static shim), use `ask_question` to let the developer decide.\n5. **Progressive CSS Enhancement**: Never replace modern CSS with heavy JavaScript layout engines. Use dual declarations (`100vh` + `100dvh`), `-webkit-` vendor prefixes, flex blowout guards (`min-width: 0`), and `@supports`.\n\n---\n\n## 4-Phase Optimization Workflow\n\n### Phase 1: Context & False-Positive Inspection\n1. **Reuse or Extract Findings**: Retrieve compatibility issues from recent conversation context, or run `npx compat-audit --build --json` (or `node bin/compat-audit.js --build --json`).\n2. **Contextual Inspection (Anti-False-Positive)**:\n   - Check source code or source maps for flagged symbols.\n   - For prototype methods (`.at()`, `.groupBy()`): verify if they are invoked on genuine built-in types (`Array`, `String`, `TypedArray`) rather than domain models or collections with homonymous methods.\n   - For modern syntax (`?.`, `??`, `??=`): identify which file and package emitted the syntax. If already handled by a downstream polyfill service or conditional feature test, mark as safe.\n\n### Phase 2: Root-Cause Remediation Tree\n\n#### Category A: Modern Syntax (BLOCKING - `SyntaxError`)\n- **Root Cause**: Bundler target configured too high (e.g. `esnext`, `es2022`) or third-party package published as modern ESM without transpilation.\n- **Remediation**:\n  - Update bundler target in `vite.config.*` / `tsconfig.json` (e.g. `build: { target: 'es2020' }` or downlevel to match declared target).\n  - If leaking from `node_modules`, configure bundler transpilation for the offending package.\n\n#### Category B: Lightweight Built-ins & Prototypes (< 300B)\n- **APIs**: `Object.hasOwn`, `Array.prototype.at`, `Promise.withResolvers`, `crypto.randomUUID`, `Object.groupBy`.\n- **Remediation**: Generate clean, guarded inline shims in `src/polyfills.ts` (or `src/polyfills.js`):\n  - `Object.hasOwn`: Fallback to `Object.prototype.hasOwnProperty.call(obj, prop)`.\n  - `Array.prototype.at`: Guarded implementation on `Array`, `String`, and `TypedArray`.\n  - `Promise.withResolvers`: Guarded `{ promise, resolve, reject }` wrapper.\n  - `crypto.randomUUID`: RFC 4122 v4 generator using `crypto.getRandomValues()`.\n\n#### Category C: Complex Web APIs (Prompt Developer via `ask_question`)\n- **`structuredClone`**:\n  - Use `ask_question` with options:\n    - `(Recommended) Install @ungap/structured-clone (1.2KB gzip) for complete spec compliance (Map, Set, ArrayBuffer, circular references)`\n    - `Refactor app code to JSON.parse(JSON.stringify(dto)) if cloning only plain serializable objects`\n    - `Add audited inline deep-clone shim in src/polyfills.ts (handles POJOs, Arrays, Dates, RegExps and circular refs)`\n- **`ResizeObserver` / `IntersectionObserver`**:\n  - Use `ask_question` with options:\n    - `(Recommended) Dynamically import micro-polyfill only when window observer is missing`\n    - `Refactor component to standard scroll / window resize listener`\n\n#### Category D: CSS Progressive Enhancement (MEDIUM / LOW)\n- **Vendor Prefixes**: Prepend `-webkit-backdrop-filter`, `-webkit-appearance: none`, `-webkit-line-clamp`.\n- **Viewport Fallbacks**: Precede `100dvh` with `100vh` fallback.\n- **Flexbox WebKit Blowout**: Add `min-width: 0; min-height: 0;` to flex items with `aspect-ratio`.\n- **CSS Nesting**: Add `postcss-preset-env` or `postcss-nested` in `postcss.config.js`.\n\n---\n\n## Phase 3: Implementation & Entry Wiring\n1. **Create or Update `src/polyfills.ts`**: Write strictly guarded shims.\n2. **Wire Entry Point**: Import `src/polyfills.ts` on line 1 of the application entry point (`src/main.ts`, `src/index.ts`, `src/routes/+layout.svelte`, `app/layout.tsx`, etc.).\n3. **Update Configs**: Apply changes to `vite.config.*`, `tsconfig.json`, or PostCSS configs.\n\n---\n\n## Phase 4: Before vs After Verification Matrix\n1. **Re-run Audit**: Execute `npx compat-audit --build --json` (or `node bin/compat-audit.js --build --json`).\n2. **Present Verification Matrix**: Format in a clean table showing Target Coverage %, Audience Gap %, Resolved Issues by Severity, and Bundle Size Impact.\n3. **Detail Remaining Items**: Document any deliberate trade-offs or graceful degradation behavior.\n";

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


