import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import pc from 'picocolors';

export const COMPAT_AUDIT_SKILL = "---\nname: compat-audit\ndescription: Audit production bundles (JS, CSS, HTML) in SPAs and monorepos to determine browser support floors, detect target vs reality drift, trace internal library syntax leaks, and suggest fixes.\nallowed-tools:\n  - run_command\n  - view_file\n  - Bash\n  - ReadFile\n---\n\n# Browser Compatibility Auditor (`compat-audit`)\n\nAudit compiled production assets against MDN and Can I Use data to detect browser compatibility floors, gaps against declared targets, and severity-classified breaking impacts.\n\n## Guardrails\n- **No exploratory shell commands**: Never run `ls`, `cat`, or `find`. Inspect configs (`package.json`, `tsconfig.json`, `vite.config.*`) using `view_file` / `ReadFile`.\n- **No ad-hoc inline Node scripts**: NEVER run ad-hoc inline Node scripts (`node -e '...'`). All AST parsing and Can I Use evaluations are handled internally by `compat-audit`.\n- **Always build fresh**: Run `npx compat-audit --build --json` (or `node bin/compat-audit.js --build --json`) to avoid auditing stale assets.\n\n## Execution Steps\n1. **Inspect Intent**: Read declared targets from `package.json`, `tsconfig.json`, `vite.config.*`, or `.browserslistrc`.\n2. **Run Audit**: Execute `npx compat-audit --build --json` and parse the output JSON into memory.\n3. **Report Results**: Present a clean 4-section report using standard English engineering terms:\n   - **Executive Summary**: Verdict badge (`COMPLIANT` or `COMPATIBILITY GAP DETECTED`), asset counts, detected active polyfills (`Detected Polyfills: X active`), Target Coverage %, Measured Coverage %, and Audience Gap %.\n   - **Browser Summary Table**: Columns: `Platform | Environment | Declared Target | Minimum Supported Version | Status & Headroom`. Cover Desktop (Chrome, Safari, Firefox, Edge) and Mobile (iOS Safari, Chrome Android, Samsung Internet).\n   - **Diagnostics**: Detail source origin (`app` vs `vendor` packages via source maps), syntax vs runtime gaps, and WebKit visual quirks. Only render if issues exist.\n   - **Compatibility Issues & Breaking Impacts**: Table listing detected compatibility gaps classified by CI/Sec severity level (`BLOCKING`, `HIGH`, `MEDIUM`, `LOW`):\n     - Columns: `Severity | Feature | Impact / Error Type | Broken Browsers | Audience Loss`\n     - *Blocking*: SyntaxError (script parse failure) or TypeError (prototype method missing).\n     - *High*: ReferenceError (missing global Web API).\n     - *Medium*: Ignored CSS layout, selector or property.\n     - *Low*: Missing vendor prefix (-webkit-) or viewport styling quirk.\n4. **Next Step**: If compatibility issues exist, prompt:\n   > *\"Run `/compat-optimize` to start an interactive grill-me decision interview and arbitrate remediation strategies step-by-step.\"*\n";

export const COMPAT_OPTIMIZE_SKILL = "---\nname: compat-optimize\ndescription: Interactively grill the developer with decision prompts (ask_question) to arbitrate and apply senior-grade compatibility remediations (bundler downleveling, zero-bloat inline shims, and CSS fallbacks).\ndisable-model-invocation: true\nallowed-tools:\n  - run_command\n  - view_file\n  - replace_file_content\n  - write_to_file\n  - ask_question\n  - Bash\n  - ReadFile\n  - EditFile\n  - WriteFile\n---\n\n# Senior Compatibility Optimizer (`compat-optimize`)\n\nDiagnose and remediate browser compatibility gaps identified by `compat-audit` with the rigor of a Senior Web Platform Engineer: verify root causes, separate application code from third-party vendor leaks, reject naive fake polyfills, and **actively arbitrate every architectural choice with the developer using interactive decision prompts (`ask_question`) in a structured grill-me workflow**.\n\n---\n\n## Cardinal Rule: Mandatory Interactive Grill-Me Interview\n\n> **CRITICAL DIRECTIVE**: You are an active decision partner, NOT a passive report generator.\n> - **NEVER** dump a static analysis report and wait for text feedback.\n> - **NEVER** apply mass code modifications or create files without prior interactive confirmation.\n> - **YOU MUST** actively interview the developer step-by-step using `ask_question` modals for each category of findings before implementing solutions.\n\n---\n\n## 4-Step Interactive Optimization Workflow\n\n```mermaid\nflowchart TD\n    A[\"Phase 1: Extract Findings & Existing Polyfills\"] --> B[\"Step 1: Polyfill Architecture Interview (ask_question)\"]\n    B --> C[\"Step 2: Modern Syntax Arbitration (ask_question)\"]\n    C --> D[\"Step 3: Web APIs & Prototypes Arbitration (ask_question)\"]\n    D --> E[\"Step 4: CSS Fallbacks Arbitration (ask_question)\"]\n    E --> F[\"Phase 3: Implementation of Approved Decisions\"]\n    F --> G[\"Phase 4: Before vs After Verification Matrix\"]\n```\n\n---\n\n### Phase 1: Context & False-Positive Inspection\n\n1. **Extract Findings**:\n   Retrieve compatibility issues from recent conversation or run:\n   ```bash\n   npx compat-audit --build --json\n   ```\n2. **Inspect Detected Polyfills**:\n   Inspect `detectedPolyfills` reported by `compat-audit` (verified via runtime VM sandbox on compiled bundle chunks).\n3. **Anti-False-Positive Check**:\n   - Verify if flagged prototype methods (`.at()`, `.toSorted()`) are invoked on standard built-in types vs custom domain models.\n   - Check if source maps link flagged issues to third-party dependencies (`node_modules/`) or application code (`src/`).\n\n---\n\n### Phase 2: Interactive Decision Grill (Using `ask_question`)\n\nExecute sequential interviews with the developer using `ask_question` for each detected category:\n\n#### Interview Step 1: Polyfill Architecture Alignment\nBefore generating any shims, prompt the developer:\n- **Question**: *\"How should runtime polyfills be structured in this project?\"*\n- **Options**:\n  - `(Recommended) Use/update dedicated project polyfills file (e.g. apps/web/src/polyfills.ts or src/polyfills.ts) loaded at entry point`\n  - `Generate a new lightweight src/polyfills.ts and wire it to main entry point`\n  - `Avoid runtime shims: rely strictly on bundler downleveling and build-time transforms`\n\n#### Interview Step 2: Modern Syntax Arbitration (BLOCKING - `SyntaxError`)\n*Trigger if issues contain modern JS operators or syntax (e.g. `?.`, `??`, `??=`, `#privateField`, `static blocks`).*\n- **Question**: *\"How would you like to handle modern JS syntax ({feature}) found in {file/origin}?\"*\n- **Options**:\n  - `(Recommended) Downlevel bundler build target in vite.config / tsconfig (e.g. target: 'es2020')`\n  - `Configure bundler transpilation specifically for the offending dependency (optimizeDeps / babel)`\n  - `Accept requirement and raise declared browser target in browserslist / package.json`\n\n#### Interview Step 3: Lightweight Prototypes & Built-ins (BLOCKING/HIGH - `TypeError`)\n*Trigger for methods like `Array.prototype.toSorted`, `Array.prototype.at`, `Array.prototype.findLast`, `Object.hasOwn`, `Object.fromEntries`, `Uint8Array.fromBase64`.*\n- **Question**: *\"Which remediation strategy do you prefer for prototype method {feature}?\"*\n- **Options**:\n  - `(Recommended) Add zero-dependency inline shim (< 300 bytes) guarded by if (!...) in polyfills file`\n  - `Refactor application source code to use universal ES2015 alternatives (e.g. [...arr].sort() instead of toSorted)`\n  - `Install official vetted micro-package`\n\n#### Interview Step 4: Complex Web APIs (HIGH - `ReferenceError`)\n*Trigger for complex APIs like `structuredClone`, `ResizeObserver`, `crypto.randomUUID`.*\n- **Question**: *\"How should we handle the Web API {API} for older browsers?\"*\n- **Options**:\n  - For `structuredClone`:\n    - `(Recommended) Install @ungap/structured-clone (1.2KB gzip) for complete spec compliance (Map, Set, circular refs)`\n    - `Refactor to JSON.parse(JSON.stringify(data)) if cloning only plain serializable data`\n    - `Inject audited lightweight inline deep-clone shim into polyfills file`\n  - For `ResizeObserver` / `IntersectionObserver`:\n    - `(Recommended) Dynamically import polyfill only on browsers where window observer is missing`\n    - `Refactor component to standard window resize or scroll listener`\n\n#### Interview Step 5: CSS Progressive Enhancement (MEDIUM / LOW)\n*Trigger for CSS issues (e.g. `100dvh`, `-webkit-` prefixes, `:has()` fallback).*\n- **Question**: *\"How should CSS compatibility gaps ({feature}) be resolved?\"*\n- **Options**:\n  - `(Recommended) Dual declarations inline (e.g. height: 100vh; height: 100dvh; and -webkit- vendor prefixes)`\n  - `Configure PostCSS preset (postcss-preset-env) for automated CSS downleveling`\n  - `Leave as progressive enhancement (graceful degradation without fallback)`\n\n---\n\n### Phase 3: Implementation & Entry Wiring\n\nOnce the developer makes their selections through `ask_question`:\n1. **Apply Polyfills**: Update `src/polyfills.ts` (or `apps/web/src/polyfills.ts`) with strictly guarded shims.\n2. **Wire Entry**: Ensure polyfills are imported on line 1 of application entry points (`src/main.ts`, `src/index.ts`, `app/layout.tsx`, `src/routes/+layout.svelte`, etc.).\n3. **Update Configs**: Apply bundler target changes to `vite.config.*`, `tsconfig.json`, or PostCSS configs as selected.\n\n---\n\n### Phase 4: Before vs After Verification Matrix\n\n1. **Re-run Audit**: Execute `npx compat-audit --build --json`.\n2. **Present Verification Matrix**:\n\n| Metric | Before Optimization | After Optimization | Delta / Status |\n| :--- | :--- | :--- | :--- |\n| **Target Coverage %** | `88.4%` | `98.6%` | `+10.2%` |\n| **Audience Gap %** | `11.6%` | `1.4%` | `-10.2%` (Recovered) |\n| **Blocking Issues** | `2` | `0` | `-2` (Resolved) |\n| **High Issues** | `1` | `0` | `-1` (Resolved) |\n| **Medium / Low Issues** | `3` | `0` | `-3` (Resolved) |\n| **Active Polyfills** | `0` | `4` | `+4` (Detected & whitelisted) |\n| **Estimated Bundle Impact** | - | `+0.4 KB` | Negligible |\n\n3. **Document Remaining Items**: If any gap remains intentionally, document browser degradation notes.\n";

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


