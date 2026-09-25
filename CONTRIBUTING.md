# Contributing to compat-audit

Thank you for your interest in improving `compat-audit`! This document outlines our development workflow and commit conventions.

---

## Commit Conventions & Automated SemVer

This repository uses [Conventional Commits](https://www.conventionalcommits.org/) to automatically manage versioning and changelogs.

Every push to `main` that passes the test suite automatically triggers an automated release on npm and GitHub. The commit messages since the last release determine the next version according to [Semantic Versioning](https://semver.org/):

### 1. Patch Release (`1.0.0` ➔ `1.0.1`)
Use for backward-compatible bug fixes, documentation, internal refactoring, or maintenance:
- `fix: ...` : Bug fixes in scanner, scoring, or formatters.
- `docs: ...` : Documentation changes, README updates.
- `refactor: ...` : Code refactoring without public API changes.
- `perf: ...` : Performance improvements.
- `ci: ...` : CI/CD workflows, GitHub Actions, release pipeline scripts.
- `chore: ...` : Dependency updates, build configuration.

*Example:* `fix: correct CSS nesting detection for type selectors`

### 2. Minor Release (`1.0.0` ➔ `1.1.0`)
Use when introducing a new, backward-compatible feature or user-facing capability:
- `feat: ...` : New feature for users (new CLI flag, new scanner, new browser target).

*Example:* `feat: add support for HTML dialog and popover attributes`

### 3. Major Release (`1.0.0` ➔ `2.0.0`)
Use when introducing breaking changes that alter existing public APIs, CLI flags, or minimum required Node.js version:
- Any commit with `!` appended to the type: `feat!: ...`, `fix!: ...`, `refactor!: ...`
- Or any commit containing `BREAKING CHANGE:` in the commit body.

*Example:* `feat!: remove deprecated --legacy flag and change auditBundle return format`

---

## Development Workflow

### Requirements
- Node.js >= 18.0.0
- npm >= 9.0.0

### Getting Started
```bash
git clone https://github.com/Goodzilla/compat-audit.git
cd compat-audit
npm install
```

### Running Tests
All tests run with Node.js's native test runner (zero external testing dependencies):
```bash
npm test
```

Please make sure all tests pass before submitting a pull request.
