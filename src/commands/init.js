import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import pc from 'picocolors';

export const COMPAT_AUDIT_SKILL = `---
name: compat-audit
description: Audit production bundles (JS, CSS, HTML) in SPAs and monorepos to determine browser floors, detect target vs reality drift, trace internal library syntax leaks, and suggest fixes.
---

# Browser Compatibility Auditor (\`compat-audit\`)

Audit compiled production assets against MDN and CanIUse to determine real minimum supported browser versions, detect compatibility gaps against declared targets, and identify quick-win optimizations.

## Execution Rules
1. **NEVER run ad-hoc exploratory shell commands (\`ls\`, \`cat\`, \`find\`, etc.)**:
   Use native file reading tools (\`view_file\`) to inspect \`package.json\`, \`tsconfig.json\`, or bundler configs. Running exploratory terminal commands causes unnecessary authorization friction.
2. **NEVER run ad-hoc inline Node scripts (\`node -e '...'\`)**:
   All AST parsing and CanIUse/MDN evaluations are built directly into \`compat-audit\`.
3. **ALWAYS use the canonical CLI command with \`--build\`**:
   \`npx compat-audit --build --json\` (or \`node bin/compat-audit.js --build --json\` inside this repository).
   The \`--build\` flag automatically detects if the build output is missing and compiles assets in a single step using the detected package manager.
4. **Parse JSON in memory**: Extract \`verdict\`, \`hasGaps\`, \`coverage\`, \`audienceLoss\`, \`browserSummary\`, \`diagnostics\`, \`quickWins\`, and \`structuralBlockers\`.

---

## Audit Workflow

### 1. Configuration Inspection
- Use native file tools (\`view_file\`) to check declared intent: \`package.json\`, \`tsconfig.json\`, \`vite.config.*\`, or \`.browserslistrc\`.
- Do not run manual shell discovery.

### 2. Execution
Run the single canonical audit command:
\`\`\`bash
npx compat-audit --build --json
\`\`\`

### 3. Report Synthesis
Present results strictly following this 4-section adaptive structure using sober engineering analysis and standard English terminology:

#### 1. Executive Summary
- **Verdict**: Display clear verdict badge: **COMPLIANT** (if zero compatibility gaps) or **COMPATIBILITY GAP DETECTED**.
- **Metrics**:
  - Scanned Directory & Asset count (JS, CSS, HTML).
  - Estimated Global Coverage (\`XX.X%\`).
  - Compatibility Gap (\`0%\` if compliant, or \`-X.X% global audience loss\`).

#### 2. Browser Compatibility Summary
Render the markdown table:
| Environment | Declared Target | Minimum Supported Version | Status & Headroom |
|---|---|---|---|
| Chrome / Chromium | \`ES2015\` | \`Chrome 51+\` | ✅ Compliant (+39 versions headroom, down to v51+) |
| Safari / WebKit | \`ES2015\` | \`Safari 10+\` | ✅ Compliant (+4 versions headroom, down to v10+) |
| Firefox / Gecko | \`ES2015\` | \`Firefox 54+\` | ✅ Compliant (Supported down to v54+) |

*Never output \`all\` (e.g. \`Chrome all\`); always report the concrete minimum supported version supporting the detected baseline.*

#### 3. Diagnostics & Code Findings *(Render only if issues exist)*
- **Monorepo / Shared Package Leakage**: Internal libraries leaking untranspiled syntax (\`?.\`, \`??\`, private fields) or native CSS nesting.
- **Runtime Web APIs without polyfills**: APIs like \`structuredClone\`, \`ResizeObserver\`, or \`Array.prototype.at\`.

#### 4. Actionable Remediation Plan
- **When Compliant**: Keep concise: *"No remediation required. Bundle meets or exceeds all declared targets."*
- **When Gaps Exist**: Group actionable quick wins:
  - **Effort 1 (Micro-polyfills, ~5m)**: Lightweight runtime shims (<1.5KB).
  - **Effort 2 (Bundler/PostCSS, ~15m)**: Build configuration adjustments.
  - **Architectural Constraints (Effort 3 & 4)**: Foundational choices (e.g., native \`:has()\`).

### 4. Next Step Recommendation
If actionable quick wins exist (Effort 1 or 2), recommend the companion interactive optimizer:
> *"Run \`/compat-optimize\` to interactively apply these quick-win polyfills or bundler adjustments and verify the improved browser coverage."*
`;

export const COMPAT_OPTIMIZE_SKILL = `---
name: compat-optimize
description: Interactively apply browser compatibility quick-wins (Effort 1 runtime polyfills & Effort 2 bundler/CSS configs) to reach older browsers with minimal effort. Use when user wants to optimize browser support or mentions "/compat-optimize".
disable-model-invocation: true
---

# /compat-optimize — Interactive Compatibility Optimizer

Interactively apply low-hanging fruit optimizations identified by \`compat-audit\` to reach older browser baselines with minimal effort, zero bloat, and full safety.

## Execution Rules
1. **NEVER run ad-hoc exploratory shell commands (\`ls\`, \`cat\`, \`find\`)**:
   Use native file reading tools (\`view_file\`) for config inspection.
2. **NEVER run ad-hoc inline Node scripts (\`node -e '...'\`)**:
   Never generate dynamic eval scripts. Use native file editing tools (\`replace_file_content\`, \`write_to_file\`) for code changes.
3. **Use canonical, prefix-matchable commands**:
   - \`npx compat-audit --build --json\` (or \`node bin/compat-audit.js --build --json\` inside this repository).
   - Standard build/test commands (\`npm run build\`, \`npm test\`).
4. **Confirm all changes**: Draft and present the exact diff before writing to disk.

---

## Interactive Workflow

### 1. Pre-flight & Current Audit State
1. Check \`git status --porcelain\`: Warn the user if uncommitted changes exist to ensure full rollback safety.
2. Run canonical audit: \`npx compat-audit --build --json\` and parse results in memory.

### 2. Baseline Alignment with the User
1. Scan for declared targets (\`.browserslistrc\`, \`vite.config.*\`, \`tsconfig.json\`) using \`view_file\`.
   - If present: Confirm if the user wants to eliminate the compatibility gap and match that target.
   - If absent: Suggest industry presets:
     - **Baseline Widely Available** (~98% coverage: Chrome 105+, Safari 15.4+, Firefox 105+).
     - **Enterprise / Conservative** (~99.5% coverage: Safari 14+, Chrome 90+, Firefox 91 ESR).
2. Group audit \`quickWins\` into Effort 1 (Micro-polyfills, ~5m) and Effort 2 (Bundler/CSS configs, ~15m).
3. Confirm the scope with the user (e.g. *Apply all Effort 1 + 2*, or *Effort 1 only*).

### 3. Draft Framework-Aware Code Modifications
Present proposed diffs before applying:
- **Effort 1 (Runtime micro-polyfills)**: Create dedicated \`src/polyfills.ts\` (or \`.js\`) with zero-dependency lightweight shims (<100B each, e.g. for \`Array.prototype.at\`, \`Object.hasOwn\`, or \`@ungap/structured-clone\`). Import it at line 1 of the detected framework entry (\`src/main.ts\`, \`hooks.client.ts\`, \`app/layout.tsx\`, etc.).
- **Effort 2 (Bundler/CSS configs)**: Update Vite/PostCSS/Webpack/Babel configuration (e.g., enable \`postcss-nested\` or downlevel target).

### 4. Apply Changes, Rebuild & Test
1. Apply modifications using file-editing tools.
2. Rebuild assets: \`npm run build\` (or detected PM).
3. If tests exist, run \`npm test\` to verify no regressions.
4. If build or tests fail, offer immediate rollback (\`git restore .\`).

### 5. Validate Improvement (Before vs After)
Re-run \`npx compat-audit --build --json\` and display:
- **Minimum Supported Version Delta**: Before vs After (e.g., *Safari 15.4+ -> Safari 14.1+*).
- **Audience Reach Gain**: Global coverage delta (e.g., *+3.4%*).
- **Bundle Weight Delta**: Added size overhead (e.g., *+0.9 KB gzip*).
`;

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

        fs.symlinkSync(linkTarget, targetDir, 'dir');
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
 * supporting all major AI agent harnesses (Claude Code, Codex, Antigravity, Cursor, Zed, OpenCode)
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

    // 1. Universal Agent Standard: .agents/skills/ (Antigravity, Codex, Cursor, Zed, OpenCode)
    const agentsDir = path.join(projectRoot, '.agents', 'skills');
    writeSkillsTo(agentsDir, filesCreated);
    harnessesSupported.push('Universal Agent Standard (.agents/skills/)');

    // 2. Claude Code workspace bridge: .claude/skills/
    const claudeDir = path.join(projectRoot, '.claude', 'skills');
    bridgeSkills(agentsDir, claudeDir, filesCreated, true);
    harnessesSupported.push('Claude Code (.claude/skills/)');
  }

  return {
    isGlobal,
    harnessesSupported,
    filesCreated
  };
}


