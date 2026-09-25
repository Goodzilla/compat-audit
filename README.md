# compat-audit

> **AI Agent Skills Scaffolder & Browser Compatibility Engine for Production Bundles.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![npm version](https://img.shields.io/npm/v/compat-audit.svg)](https://www.npmjs.com/package/compat-audit)

Most compatibility tools run during static linting on raw source files. While useful, static linting misses what actually reaches users in production: bundlers transpile syntax but do not polyfill runtime Web APIs (`structuredClone`, `crypto.randomUUID`, `ResizeObserver`), third-party packages in `node_modules` inject unconfigured modern CSS (`&` nesting, `oklch`), and internal monorepo libraries leak untranspiled syntax.

`compat-audit` is designed as a dual-purpose toolkit:
1. **Universal AI Agent Skills Scaffolder**: Deploys native skills compatible across all major agent harnesses (Claude Code, Google Antigravity, OpenAI Codex, Cursor, Zed, OpenCode, Aider) to autonomously audit and interactively fix compatibility drift.
2. **Deterministic CLI & CI/CD Engine**: Fast, zero-config AST scanner backed by MDN Browser Compat Data and Can I Use statistics with automatic baseline standards resolution and headroom calculations.

---

## Instant Setup: Scaffold AI Agent Skills

Add native compatibility skills to your project or machine with a single command:

```bash
npx compat-audit --init-skills
```

Running `init` interactively prompts you to choose your desired scope:
1. **Project workspace**: Installs to `.agents/skills/` (the open agent standard) and creates a `.claude/skills/` bridge so the skills work across Claude Code, Antigravity, Codex, Cursor, Zed, and OpenCode.
2. **Global (machine-wide)**: Installs to `~/.agents/skills/`, `~/.claude/skills/`, and `~/.gemini/config/skills/` for instant availability across every repository on your machine.

*(You can bypass the prompt with `--local` / `-l` or `--global` / `-g`)*.

This scaffolds two production-ready skills:

| Skill | Mode | Role & Capabilities |
|---|---|---|
| **`/compat-audit`** | Autonomous (Model-invocable) | Scans production bundles, calculates concrete minimum browser support floors across Chrome, Safari, Firefox, and Edge with baseline awareness (no misleading `Chrome all`), computes safety headroom against declared targets, detects source attribution (app code vs 3rd-party vendor leakage), and produces an adaptive 4-tier report. |
| **`/compat-optimize`** | Interactive (`disable-model-invocation: true`) | Guided interactive workflow with **Context Reuse** (reuses previous audits without redundant re-builds), **Zero Repo Pollution** (ships an audited zero-dependency inline polyfill cookbook with **zero** `npm install`/`pnpm add` commands), and **1-Turn Turnaround** proposing unified diffs immediately. |

### How Agents Use These Skills

- **Autonomous Auditing**: Whenever you build or ask *"What is our browser compatibility floor?"*, your agent triggers `/compat-audit`, parses the bundle ASTs in memory, and gives you a structured floor matrix and ROI quick-wins.
- **One-Command Remediation**: Type `/compat-optimize` in your agent chat. The agent checks Git status, presents exact code diffs before touching files, adds lightweight tree-shakable shims, updates bundler configs, rebuilds, and executes tests with rollback protection.

---

## CLI and CI/CD Usage

`compat-audit` can also be run directly from terminal sessions, GitHub Actions, or pre-commit hooks:

```bash
npx compat-audit [dir] [options]
```

### Options

| Flag | Description | Default |
|---|---|---|
| `[dir]` | Target build directory (`dist`, `.output/public`, etc.) | Auto-detected |
| `--build` | Force fresh build of production assets with detected package manager before scanning | `false` |
| `init`, `--init-skills` | Scaffold AI agent skills (interactive local vs global prompt) | |
| `--local`, `-l` | Install skills to project workspace (`.agents/skills/` + `.claude/skills/`) | `true` |
| `--global`, `-g` | Install skills globally (`~/.agents/skills/`, `~/.claude/skills/`, etc.) | `false` |
| `--format <type>` | Output format: `terminal` (default), `json`, `markdown` | `terminal` |
| `--json` | Shorthand for `--format json` | |
| `--markdown`, `--md` | Shorthand for `--format markdown` | |
| `--fail-on-incompatible` | Exit with code 1 if compatibility issues exist (CI gate) | `false` |
| `-h`, `--help` | Show help screen | |
| `-v`, `--version` | Show version | |

### CI / PR Verification Example

Add `compat-audit` to your pull request workflow:

```bash
# Force fresh build and fail CI if production bundle breaks target compatibility
npx compat-audit --build --fail-on-incompatible --markdown >> $GITHUB_STEP_SUMMARY
```

---

## Effort Taxonomy (ROI Scoring)

Issues detected in bundles are categorized into four deterministic effort tiers:

- **E1 (Lightweight Runtime Polyfill, ~5 mins)**: Trivial micro-shims (< 1.5 KB total) with zero architectural impact (`structuredClone`, `Array.prototype.at`, `Object.hasOwn`, `crypto.randomUUID`).
- **E2 (Configuration Change, ~15 mins)**: Bundler target adjustments or PostCSS plugins (syntax downleveling, `postcss-nested`, color fallbacks).
- **E3 (Moderate Polyfill, ~45 mins)**: Heavier shims with runtime trade-offs (`ResizeObserver`, `IntersectionObserver`).
- **E4 (Architectural Refactor)**: Structural layout engine features lacking clean polyfills (dynamic `:has()`, `@container`).

---

## Example Output

### Terminal Report (`default`)

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                       COMPAT-AUDIT BUNDLE REPORT                          ║
╚═══════════════════════════════════════════════════════════════════════════╝

Status:             COMPLIANT
Scanned Directory:  dist
Assets Scanned:     38 files (24 JS, 11 CSS, 3 HTML)
Estimated Coverage: 100% global audience
Compatibility Gap:  0% (Full target alignment)

BROWSER COMPATIBILITY SUMMARY:
   ✔ Chrome          (target: ES2015)     min: 51+     aligned
   ✔ Safari          (target: ES2015)     min: 10+     aligned
   ✔ Firefox         (target: ES2015)     min: 54+     aligned
   ✔ Edge            (target: ES2015)     min: 15+     aligned
   ✔ iOS Safari      (target: ES2015)     min: 10+     aligned
   ✔ Chrome Android  (target: ES2015)     min: 51+     aligned

ACTIONABLE REMEDIATIONS (Polyfills & Configuration):
   No immediate remediation required. Bundle meets or exceeds all declared targets.

Run with --format json or --format markdown for CI/CD or PR integrations.
```

When compatibility gaps are detected:

```
╔═══════════════════════════════════════════════════════════════════════════╗
║                       COMPAT-AUDIT BUNDLE REPORT                          ║
╚═══════════════════════════════════════════════════════════════════════════╝

Status:             COMPATIBILITY GAP DETECTED
Scanned Directory:  dist
Assets Scanned:     12 files (8 JS, 4 CSS)
Estimated Coverage: 95.1% global audience
Compatibility Gap:  -4.9%

BROWSER COMPATIBILITY SUMMARY:
   ✔ Chrome          (target: Chrome 90+)  min: 51+     +39 vers headroom
   ⚠ Safari          (target: Safari 14+)  min: 15.4+   Gap: -1.4 vers
   ✔ Firefox         (target: Firefox 88+) min: 54+     +34 vers headroom
   ✔ Edge            (target: Edge 90+)    min: 15+     +75 vers headroom

DIAGNOSTICS & CODE FINDINGS:
   ! Syntax vs Runtime Gap: Your bundler targets 'es2020', but the bundle contains runtime Web APIs (structuredClone).
   ! CSS Nesting without fallback: Native CSS nesting (&) is emitted in your CSS bundle. Older browser engines (Safari < 16.5) will ignore these nested rules.

ACTIONABLE REMEDIATIONS (Polyfills & Configuration):
   ┌───────┬───────────────────────────────┬─────────────┬─────────────┬────────────────────────────────────────────────────────┐
   │ Level │ Feature                       │ Category    │ Est. Time   │ Recommended Action                                     │
   ├───────┼───────────────────────────────┼─────────────┼─────────────┼────────────────────────────────────────────────────────┤
   │   E1  │ structuredClone()             │ api         │ ~5 mins     │ Inline structuredClone shim (<100B) in polyfills entry │
   │   E2  │ Native CSS Nesting (&)        │ selector    │ ~15 mins    │ Enable postcss-nested in postcss.config.js             │
   └───────┴───────────────────────────────┴─────────────┴─────────────┴────────────────────────────────────────────────────────┘
```

---

## Programmatic API

You can also run audits programmatically in Node.js scripts or custom build pipelines:

```javascript
import { auditBundle, initSkills } from 'compat-audit';

// 1. Audit compiled assets (optionally force fresh build)
const report = await auditBundle({
  dir: 'dist',
  build: true, // Forces fresh build before scanning
  cwd: process.cwd()
});

console.log(report.verdict); // 'COMPLIANT' or 'COMPATIBILITY GAP DETECTED'
console.log(report.browserSummary);
// [
//   { browser: 'Chrome', declaredTarget: 'ES2015', minVersion: 51, status: 'compliant', ... },
//   ...
// ]

// 2. Scaffold skills programmatically
initSkills({ cwd: process.cwd() });
```

---

## Contributing

Contributions are welcome! Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our commit conventions, automated SemVer release pipeline, and development workflow.

## Licenses and Data Sources

- Software licensed under the [MIT License](LICENSE).
- Browser compatibility data from [@mdn/browser-compat-data](https://github.com/mdn/browser-compat-data) ([CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/)).
- Browser usage statistics from [caniuse-lite](https://github.com/browserslist/caniuse-lite) ([CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/)).
- See [LICENSE-THIRD-PARTY.md](LICENSE-THIRD-PARTY.md) for details.
