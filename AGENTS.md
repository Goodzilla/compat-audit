# AGENTS.md — Context and Guidelines for AI Coding Agents

This document defines the architecture, technical constraints, and developer conventions for AI coding agents (Antigravity, Claude Code, Cursor, Codex, OpenCode) contributing to `compat-audit`.

---

## 1. Project Overview

- **Package**: `compat-audit` (open-source public npm package).
- **Purpose**: Zero-config browser compatibility engine and AI agent skill scaffolder for production bundles (`dist/`, `.output/`, etc.) in SPAs and monorepos.
- **Repository**: `https://github.com/Goodzilla/compat-audit`
- **Registry**: npm (`https://registry.npmjs.org/`).
- **Required Runtime**: Node.js >= 20.0.0 (Native ECMAScript Modules `"type": "module"`).

---

## 2. Agent Behavioral Rules

### Zero Emojis
- No emojis anywhere: not in code, logs, commit messages, CI workflows, or user responses.
- Keep output plain, clean, and compliant with standard Unix/CI formats.

### Zero Slop, Zero Marketing Fluff
- Direct, pragmatic engineering focus.
- Avoid promotional language, corporate filler, or marketing jargon.
- Explain technical causes, concrete remediation steps, and measurable impact.

### Language Conventions
- Technical interactions and explanations: French or English, clear and concise.
- Code, identifiers, comments, tests, and commit messages: strictly English.

---

## 3. Git Workflow & Safety

### Golden Rule: Never Git Push Without Explicit Permission
- Do not execute `git push` unless the user explicitly requested and authorized it in conversation.

### Strict Conventional Commits
- All commit messages must follow the Conventional Commits specification:
  - `feat: ...` (user-facing features)
  - `fix: ...` (bug fixes)
  - `docs: ...` (documentation changes)
  - `test: ...` (adding or updating tests)
  - `refactor: ...` (refactoring without behavior change)
  - `chore: ...` (maintenance, dependencies)
- Commits on `main` automatically drive SemVer versioning and releases via `semantic-release`.

### Mandatory Verification Before Commits
- Always run the full test suite before committing:
  ```bash
  npm test
  ```
- All test suites must pass 100%.

### Minimal Dependencies
- Do not introduce heavy or superfluous external dependencies.
- Prefer native Node.js built-ins (`node:fs`, `node:path`, `node:child_process`, `node:module`, `node:test`).

---

## 4. Engine Architecture & Core Principles

The engine relies on 100% deterministic, offline static analysis (zero network requests and zero runtime AI inference during bundle scanning):

1. **AST Scanners**:
   - `src/scanners/js.js`: JavaScript analysis via **Acorn** and **acorn-walk**. Analyzes lexical scope to filter out local variable bindings, function arguments, and imports, isolating genuine global Web API and prototype usage. Detects feature guards (`typeof`, `in`, `try-catch`).
   - `src/scanners/css.js`: CSS stylesheet analysis via **css-tree** (modern properties, selectors, missing `-webkit-` prefixes, viewport unit quirks).
   - `src/scanners/html.js`: HTML analysis via **htmlparser2** (modern tags, attributes).
2. **Compatibility Datasets & Region Support**:
   - `@mdn/browser-compat-data` for browser support matrices.
   - `caniuse-lite` for audience coverage statistics.
   - Dynamic region support: defaults to `'global'` (`usage_global`), supports any regional code (e.g. `--region FR`, `--region US`).
3. **Monorepos & Workspaces** (`src/adapters/workspace.js`):
   - Automatically detects root workspace configs (`pnpm-workspace.yaml`, `workspace.yml`, `package.json#workspaces`, `lerna.json`).
   - Audits all projects independently, outputs global summary table and full per-project diagnostics.
   - Supports targeting specific sub-projects via `--project <name>`.
4. **CI/Sec Severity Scale (BLOCKING, HIGH, MEDIUM, LOW)** (`src/scoring/severity.js`):
   - **BLOCKING**: Fatal execution errors breaking application execution (`SyntaxError` on untranspiled syntax, `TypeError` on missing prototype method).
   - **HIGH**: `ReferenceError` on missing global Web API (`structuredClone`, `crypto.randomUUID`, etc.).
   - **MEDIUM**: Visual or layout degradation caused by ignored CSS rule, selector, or property (`:has()`, `@container`, `color: light-dark()`).
   - **LOW**: Minor visual glitch or missing WebKit vendor prefix (`-webkit-backdrop-filter`, `100vh` without `100dvh`).
5. **Optimization Playbook** (`src/optimization/playbook.js`):
   - Technical catalog of zero-bloat remédiations and inline shims used by `/compat-optimize`.
6. **AI Skills Scaffolder** (`src/commands/init.js`):
   - Scaffolds `/compat-audit` and `/compat-optimize` agent skills into `.agents/skills/` (project) or user home directories (global) with support for Claude Code, Antigravity, Cursor, and Codex.

---

## 5. Reference Commands

```bash
# Run tests
npm test

# Check commit message format
echo "feat: add support for CSS container queries" | npx commitlint

# Run CLI locally
node bin/compat-audit.js [dist]
```
