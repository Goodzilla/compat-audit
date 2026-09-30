---
name: compat-audit
description: Audit production bundles (JS, CSS, HTML) in SPAs and monorepos to determine browser support floors, detect target vs reality drift, trace internal library syntax leaks, and suggest fixes.
allowed-tools:
  - run_command
  - view_file
  - Bash
  - ReadFile
---

# Browser Compatibility Auditor (`compat-audit`)

Audit compiled production assets against MDN and Can I Use data to detect browser compatibility floors, gaps against declared targets, and severity-classified breaking impacts.

## Guardrails
- **No exploratory shell commands**: Never run `ls`, `cat`, or `find`. Inspect configs (`package.json`, `tsconfig.json`, `vite.config.*`) using `view_file` / `ReadFile`.
- **No ad-hoc inline Node scripts**: NEVER run ad-hoc inline Node scripts (`node -e '...'`). All AST parsing and Can I Use evaluations are handled internally by `compat-audit`.
- **Always build fresh**: Run `npx compat-audit --build --json` (or `node bin/compat-audit.js --build --json`) to avoid auditing stale assets.

## Execution Steps
1. **Inspect Intent**: Read declared targets from `package.json`, `tsconfig.json`, `vite.config.*`, or `.browserslistrc`.
2. **Run Audit**: Execute `npx compat-audit --build --json` and parse the output JSON into memory.
3. **Report Results**: Present a clean 4-section report using standard English engineering terms:
   - **Executive Summary**: Verdict badge (`COMPLIANT` or `COMPATIBILITY GAP DETECTED`), asset counts, Target Coverage %, Measured Coverage %, and Audience Gap %.
   - **Browser Summary Table**: Columns: `Platform | Environment | Declared Target | Minimum Supported Version | Status & Headroom`. Cover Desktop (Chrome, Safari, Firefox, Edge) and Mobile (iOS Safari, Chrome Android, Samsung Internet).
   - **Diagnostics**: Detail source origin (`app` vs `vendor` packages via source maps), syntax vs runtime gaps, and WebKit visual quirks. Only render if issues exist.
   - **Compatibility Issues & Breaking Impacts**: Table listing detected compatibility gaps classified by CI/Sec severity level (`BLOCKING`, `HIGH`, `MEDIUM`, `LOW`):
     - Columns: `Severity | Feature | Impact / Error Type | Broken Browsers | Audience Loss`
     - *Blocking*: SyntaxError (script parse failure) or TypeError (prototype method missing).
     - *High*: ReferenceError (missing global Web API).
     - *Medium*: Ignored CSS layout, selector or property.
     - *Low*: Missing vendor prefix (-webkit-) or viewport styling quirk.
4. **Next Step**: If compatibility issues exist, prompt:
   > *"Run `/compat-optimize` to interactively resolve these compatibility issues and verify improved browser coverage."*
