import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  parseYamlPackages,
  detectWorkspaceConfig,
  resolveWorkspacePatterns,
  findWorkspace
} from '../src/adapters/workspace.js';
import { auditBundle } from '../src/index.js';
import { runCli } from '../src/cli.js';
import { formatTerminalReport } from '../src/formatters/terminal.js';
import { formatMarkdownReport } from '../src/formatters/markdown.js';

describe('Monorepo workspace adapter & parser tests', () => {
  it('parses packages and projects list from YAML content', () => {
    const yaml1 = `
packages:
  - 'apps/*'
  - "packages/*"
  - components/player
`;
    assert.deepEqual(parseYamlPackages(yaml1), [
      'apps/*',
      'packages/*',
      'components/player'
    ]);

    const yamlProjects = `
# Workspace configuration
projects:
  - 'services/*'
  - frontend
`;
    assert.deepEqual(parseYamlPackages(yamlProjects), [
      'services/*',
      'frontend'
    ]);

    const yamlInline = `packages: ['apps/*', 'packages/*']`;
    assert.deepEqual(parseYamlPackages(yamlInline), [
      'apps/*',
      'packages/*'
    ]);
  });

  it('detects workspace configuration in priority order', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'compat-audit-ws-test-'));

    try {
      // 1. package.json with workspaces
      fs.writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
        name: 'root-repo',
        workspaces: ['apps/*']
      }));
      let detected = detectWorkspaceConfig(tmpDir);
      assert.equal(detected.configFile, 'package.json');
      assert.deepEqual(detected.patterns, ['apps/*']);

      // 2. pnpm-workspace.yaml takes precedence over package.json
      fs.writeFileSync(path.join(tmpDir, 'pnpm-workspace.yaml'), `packages:\n  - 'modules/*'\n`);
      detected = detectWorkspaceConfig(tmpDir);
      assert.equal(detected.configFile, 'pnpm-workspace.yaml');
      assert.deepEqual(detected.patterns, ['modules/*']);

      // 3. workspace.yml takes precedence over pnpm-workspace.yaml
      fs.writeFileSync(path.join(tmpDir, 'workspace.yml'), `packages:\n  - 'apps/*'\n  - 'packages/*'\n`);
      detected = detectWorkspaceConfig(tmpDir);
      assert.equal(detected.configFile, 'workspace.yml');
      assert.deepEqual(detected.patterns, ['apps/*', 'packages/*']);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('resolves workspace directory patterns and ignores exclusions', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'compat-audit-resolve-test-'));

    try {
      fs.mkdirSync(path.join(tmpDir, 'apps/player'), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, 'apps/web'), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, 'apps/test-app'), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, 'packages/ui'), { recursive: true });

      const resolved = resolveWorkspacePatterns(tmpDir, ['apps/*', '!**/test-app/**', 'packages/ui']);
      const relPaths = resolved.map(p => path.relative(tmpDir, p)).sort();

      assert.deepEqual(relPaths, ['apps/player', 'apps/web', 'packages/ui']);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});

describe('Monorepo multi-project audit and reporting tests', () => {
  let tmpMonorepo;

  before(() => {
    tmpMonorepo = fs.mkdtempSync(path.join(os.tmpdir(), 'compat-audit-full-ws-'));

    // workspace.yml
    fs.writeFileSync(path.join(tmpMonorepo, 'workspace.yml'), `
packages:
  - 'apps/*'
`);

    // App 1: compliant app (ES2015 baseline code)
    const app1Dir = path.join(tmpMonorepo, 'apps/player');
    const app1Dist = path.join(app1Dir, 'dist');
    fs.mkdirSync(app1Dist, { recursive: true });
    fs.writeFileSync(path.join(app1Dir, 'package.json'), JSON.stringify({
      name: '@scope/player',
      version: '1.0.0'
    }));
    fs.writeFileSync(path.join(app1Dist, 'main.js'), `
      console.log('App 1 bundle');
      var list = [1, 2, 3];
      var mapped = list.map(function(x) { return x * 2; });
    `);

    // App 2: app with modern features causing gaps
    const app2Dir = path.join(tmpMonorepo, 'apps/web');
    const app2Dist = path.join(app2Dir, 'dist');
    fs.mkdirSync(app2Dist, { recursive: true });
    fs.writeFileSync(path.join(app2Dir, 'package.json'), JSON.stringify({
      name: '@scope/web',
      version: '2.0.0'
    }));
    fs.writeFileSync(path.join(app2Dist, 'bundle.js'), `
      // Uses modern Array.at
      var arr = [10, 20];
      var last = arr.at(-1);
    `);
  });

  after(() => {
    if (tmpMonorepo) {
      fs.rmSync(tmpMonorepo, { recursive: true, force: true });
    }
  });

  it('runs audit on all workspace projects and returns monorepo report', async () => {
    const report = await auditBundle({ cwd: tmpMonorepo });

    assert.equal(report.isMonorepo, true);
    assert.equal(report.workspaceConfig, 'workspace.yml');
    assert.equal(report.summary.totalProjects, 2);
    assert.equal(report.projects.length, 2);

    const playerProj = report.projects.find(p => p.name === '@scope/player');
    const webProj = report.projects.find(p => p.name === '@scope/web');

    assert.ok(playerProj, 'Player project should be audited');
    assert.ok(webProj, 'Web project should be audited');

    // App 2 has Array.at which causes a gap vs baseline ES2015
    assert.equal(webProj.report.issues.some(w => w.featureKey === 'javascript.builtins.Array.at'), true);
  });

  it('allows filtering by project in workspace', async () => {
    const report = await auditBundle({ cwd: tmpMonorepo, project: 'player' });

    assert.equal(report.isMonorepo, true);
    assert.equal(report.projects.length, 1);
    assert.equal(report.projects[0].name, '@scope/player');
  });

  it('formats terminal report with top monorepo summary AND full report per project', async () => {
    const report = await auditBundle({ cwd: tmpMonorepo });
    const term = formatTerminalReport(report);

    // 1. Top summary banner and table
    assert.ok(term.includes('COMPAT-AUDIT MONOREPO SUMMARY'));
    assert.ok(term.includes('MONOREPO PROJECTS RECAP:'));
    assert.ok(term.includes('workspace.yml'));
    assert.ok(term.includes('@scope/player'));
    assert.ok(term.includes('@scope/web'));

    // 2. Full individual reports per project
    assert.ok(term.includes('PROJECT [1/2]:'));
    assert.ok(term.includes('PROJECT [2/2]:'));
    assert.ok(term.includes('BROWSER COMPATIBILITY SUMMARY'));
    assert.ok(term.includes('COMPATIBILITY ISSUES & BREAKING IMPACTS'));
  });

  it('formats markdown report with monorepo summary table and full sections per project', async () => {
    const report = await auditBundle({ cwd: tmpMonorepo });
    const md = formatMarkdownReport(report);

    assert.ok(md.includes('# Monorepo Browser Compatibility Audit Report'));
    assert.ok(md.includes('## Monorepo Summary'));
    assert.ok(md.includes('`workspace.yml`'));
    assert.ok(md.includes('## Project: @scope/player'));
    assert.ok(md.includes('## Project: @scope/web'));
    assert.ok(md.includes('1. Executive Summary'));
    assert.ok(md.includes('2. Browser Compatibility Summary'));
  });

  it('executes runCli without arguments or with flags without ReferenceError', async () => {
    const originalLog = console.log;
    let logged = '';
    console.log = (msg) => { logged += msg + '\n'; };
    const prevCwd = process.cwd();
    process.chdir(tmpMonorepo);
    try {
      await runCli(['--json']);
      assert.ok(logged.includes('@scope/player'));
      assert.ok(logged.includes('"isMonorepo": true'));
    } finally {
      process.chdir(prevCwd);
      console.log = originalLog;
    }
  });
});
