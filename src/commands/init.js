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
3. **ALWAYS force fresh build with \`--build\`**:
   \`npx compat-audit --build --json\` (or \`node bin/compat-audit.js --build --json\` inside this repository).
   The \`--build\` flag forces an unconditional fresh build using the detected package manager, guaranteeing that audits never evaluate stale build output.
4. **Parse JSON in memory**: Extract \`verdict\`, \`hasGaps\`, \`coverage\`, \`audienceLoss\`, \`browserSummary\`, \`diagnostics\`, \`quickWins\`, and \`structuralBlockers\`.

---

## Audit Workflow

### 1. Configuration Inspection
- Use native file tools (\`view_file\`) to check declared intent: \`package.json\`, \`tsconfig.json\`, \`vite.config.*\`, or \`.browserslistrc\`.
- Do not run manual shell discovery.

### 2. Execution
Run the canonical audit command (forces fresh build + scans in 1 step):
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
- **Source Attribution**: Distinguish whether modern syntax/APIs originate from application code vs 3rd-party vendor dependencies (\`origin: 'vendor'\`).
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

# /compat-optimize — Senior Interactive Compatibility Optimizer

Apply high-ROI browser compatibility remediations identified by \`compat-audit\` to eliminate compatibility gaps with zero bloat, zero repository pollution, and 1-turn turnaround.

## Execution Rules
1. **REUSE CONTEXT FIRST (No redundant audits)**:
   If an audit was already performed earlier in the conversation, **DO NOT run a new build or audit**. Directly reuse the existing findings, targets, and \`quickWins\` from the context history.
   Only run \`npx compat-audit --build --json\` if no audit data exists in the conversation or if the user explicitly requests a fresh re-scan.
2. **ZERO REPO POLLUTION (NEVER run package installs)**:
   **NEVER execute \`npm install\`, \`pnpm add\`, or \`yarn add\`**.
   Never install external packages for Effort 1 micro-polyfills. External installs pollute the project tree (e.g. creating unwanted \`.pnpm-store\` folders) and bloat dependencies. All micro-polyfills MUST be 100% inline zero-dependency vanilla shims.
3. **NO AD-HOC EXPLORATORY SHELL COMMANDS**:
   Never run \`ls\`, \`cat\`, or \`find\`. Use native file tools (\`view_file\`, \`replace_file_content\`, \`write_to_file\`).
4. **1-TURN DETERMINISTIC PROPOSAL**:
   Do not initiate multiple round-trips asking questions. Formulate the optimal unified diff immediately in Turn 1 and present it clearly to the user.

---

## Interactive Workflow

### 1. Context Extraction or Fresh Audit
- **Scenario A (Audit already in context)**:
  Extract the declared targets, limiting browsers, and \`quickWins\` list directly from previous messages. Proceed immediately to Step 2.
- **Scenario B (No audit in context)**:
  Run \`npx compat-audit --build --json\` once and parse results in memory.

### 2. Formulate Single-Shot Solution
Select remedies based on detected gaps:

#### Effort 1: Zero-Dependency Polyfill Cookbook (\`src/polyfills.ts\` or \`.js\`)
When missing global APIs are detected, create \`src/polyfills.ts\` using exclusively these audited inline implementations:

\`\`\`typescript
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
\`\`\`

#### Effort 2: Bundler / CSS Adjustments
- **CSS Nesting**: Add \`postcss-preset-env\` or \`postcss-nested\` into \`postcss.config.js\`.
- **Syntax Downleveling**: Update target in \`vite.config.ts\` (e.g. \`build: { target: 'es2020' }\`).

### 3. Application & Entry Wiring
1. Detect framework entry file (\`src/main.ts\`, \`src/main.tsx\`, \`src/index.ts\`, \`src/app.tsx\`, \`src/routes/+layout.svelte\`).
2. Add \`import './polyfills';\` at line 1.
3. Write or update files using \`write_to_file\` or \`replace_file_content\`.

### 4. Build & Verify
1. Re-run \`npx compat-audit --build --json\` to verify the gap closure.
2. Present the Before vs After delta:
   - **Minimum Supported Version Delta**: (e.g., *Safari 15.4+ -> Safari 13.0+*).
   - **Audience Reach Gain**: Global coverage delta (e.g., *+3.2% global audience reach*).
   - **Bundle Weight Overhead**: Zero npm packages added, ~250 bytes gzip.
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


