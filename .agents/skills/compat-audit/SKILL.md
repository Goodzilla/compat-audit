---
name: compat-audit
description: Audit production bundles (JS, CSS, HTML) in SPAs and monorepos to determine browser floors, detect target vs reality drift, trace internal library syntax leaks, and suggest fixes.
---

# Browser Compatibility Auditor (`compat-audit`)

Audit compiled production assets against MDN and CanIUse to determine real minimum supported browser versions, detect compatibility gaps against declared targets, and identify quick-win optimizations.

## Execution Rules
1. **NEVER run ad-hoc exploratory shell commands (`ls`, `cat`, `find`, etc.)**:
   Use native file reading tools (`view_file`) to inspect `package.json`, `tsconfig.json`, or bundler configs. Running exploratory terminal commands causes unnecessary authorization friction.
2. **NEVER run ad-hoc inline Node scripts (`node -e '...'`)**:
   All AST parsing and CanIUse/MDN evaluations are built directly into `compat-audit`.
3. **ALWAYS use the canonical CLI command with `--build`**:
   `npx compat-audit --build --json` (or `node bin/compat-audit.js --build --json` inside this repository).
   The `--build` flag automatically detects if the build output is missing and compiles assets in a single step using the detected package manager.
4. **Parse JSON in memory**: Extract `verdict`, `hasGaps`, `coverage`, `audienceLoss`, `browserSummary`, `diagnostics`, `quickWins`, and `structuralBlockers`.

---

## Audit Workflow

### 1. Configuration Inspection
- Use native file tools (`view_file`) to check declared intent: `package.json`, `tsconfig.json`, `vite.config.*`, or `.browserslistrc`.
- Do not run manual shell discovery.

### 2. Execution
Run the single canonical audit command:
```bash
npx compat-audit --build --json
```

### 3. Report Synthesis
Present results strictly following this 4-section adaptive structure using sober engineering analysis and standard English terminology:

#### 1. Executive Summary
- **Verdict**: Display clear verdict badge: **COMPLIANT** (if zero compatibility gaps) or **COMPATIBILITY GAP DETECTED**.
- **Metrics**:
  - Scanned Directory & Asset count (JS, CSS, HTML).
  - Estimated Global Coverage (`XX.X%`).
  - Compatibility Gap (`0%` if compliant, or `-X.X% global audience loss`).

#### 2. Browser Compatibility Summary
Render the markdown table:
| Environment | Declared Target | Minimum Supported Version | Status & Headroom |
|---|---|---|---|
| Chrome / Chromium | `ES2015` | `Chrome 51+` | ✅ Compliant (+39 versions headroom, down to v51+) |
| Safari / WebKit | `ES2015` | `Safari 10+` | ✅ Compliant (+4 versions headroom, down to v10+) |
| Firefox / Gecko | `ES2015` | `Firefox 54+` | ✅ Compliant (Supported down to v54+) |

*Never output `all` (e.g. `Chrome all`); always report the concrete minimum supported version supporting the detected baseline.*

#### 3. Diagnostics & Code Findings *(Render only if issues exist)*
- **Monorepo / Shared Package Leakage**: Internal libraries leaking untranspiled syntax (`?.`, `??`, private fields) or native CSS nesting.
- **Runtime Web APIs without polyfills**: APIs like `structuredClone`, `ResizeObserver`, or `Array.prototype.at`.

#### 4. Actionable Remediation Plan
- **When Compliant**: Keep concise: *"No remediation required. Bundle meets or exceeds all declared targets."*
- **When Gaps Exist**: Group actionable quick wins:
  - **Effort 1 (Micro-polyfills, ~5m)**: Lightweight runtime shims (<1.5KB).
  - **Effort 2 (Bundler/PostCSS, ~15m)**: Build configuration adjustments.
  - **Architectural Constraints (Effort 3 & 4)**: Foundational choices (e.g., native `:has()`).

### 4. Next Step Recommendation
If actionable quick wins exist (Effort 1 or 2), recommend the companion interactive optimizer:
> *"Run `/compat-optimize` to interactively apply these quick-win polyfills or bundler adjustments and verify the improved browser coverage."*
