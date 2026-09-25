import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getBaselineSupport, BASELINE_STANDARDS } from '../src/data/compat-db.js';
import { resolveDeclaredTargets } from '../src/adapters/bundlers.js';
import { formatMarkdownReport } from '../src/formatters/markdown.js';
import { formatTerminalReport } from '../src/formatters/terminal.js';

describe('Baseline standards & target resolution tests', () => {
  it('correctly returns baseline versions for standards', () => {
    const es2015 = getBaselineSupport('es2015');
    assert.equal(es2015.chrome, 51);
    assert.equal(es2015.safari, 10);
    assert.equal(es2015.firefox, 54);
    assert.equal(es2015.edge, 15);

    const es2020 = getBaselineSupport('es2020');
    assert.equal(es2020.chrome, 80);
    assert.equal(es2020.safari, 13.1);

    const modules = getBaselineSupport('modules');
    assert.equal(modules.chrome, 80);

    const fallback = getBaselineSupport('unknown_standard');
    assert.equal(fallback.chrome, 51);
  });

  it('resolves declared targets from config', () => {
    const targets = resolveDeclaredTargets({ target: 'es2015' });
    assert.equal(targets.browsers.chrome.targetVersion, 51);
    assert.equal(targets.browsers.safari.targetVersion, 10);

    const arrayTargets = resolveDeclaredTargets({ target: ['chrome90', 'safari14'] });
    assert.equal(arrayTargets.browsers.chrome.targetVersion, 90);
    assert.equal(arrayTargets.browsers.safari.targetVersion, 14);
  });
});

describe('Report formatters and English terminology', () => {
  const mockReportCompliant = {
    targetDir: 'dist',
    totalFiles: 10,
    totalJsFiles: 6,
    totalCssFiles: 3,
    totalHtmlFiles: 1,
    verdict: 'COMPLIANT',
    hasGaps: false,
    coverage: 100,
    audienceLoss: 0,
    browserFloor: { chrome: 51, safari: 10, firefox: 54, edge: 15, ios_saf: 10, chrome_android: 51 },
    browserSummary: [
      {
        key: 'chrome',
        browser: 'Chrome',
        declaredTarget: 'ES2015',
        targetVersion: 90,
        minVersion: 51,
        minVersionStr: 'Chrome 51+',
        status: 'compliant',
        statusLabel: '✅ Compliant (+39 versions headroom, down to v51+)',
        headroom: 39,
        gap: 0
      },
      {
        key: 'safari',
        browser: 'Safari',
        declaredTarget: 'ES2015',
        targetVersion: 14,
        minVersion: 10,
        minVersionStr: 'Safari 10+',
        status: 'compliant',
        statusLabel: '✅ Compliant (+4 versions headroom, down to v10+)',
        headroom: 4,
        gap: 0
      }
    ],
    quickWins: [],
    structuralBlockers: [],
    diagnostics: []
  };

  it('generates compliant markdown report with English terms and headroom', () => {
    const md = formatMarkdownReport(mockReportCompliant);
    assert.ok(md.includes('Executive Summary'));
    assert.ok(md.includes('Browser Compatibility Summary'));
    assert.ok(md.includes('Minimum Supported Version'));
    assert.ok(md.includes('Status & Headroom'));
    assert.ok(md.includes('Verdict: COMPLIANT'));
    assert.ok(md.includes('+39 versions headroom'));
    assert.ok(!md.includes('Chrome all'), 'Must not contain "Chrome all"');
  });

  it('generates terminal report with English terms', () => {
    const term = formatTerminalReport(mockReportCompliant);
    assert.ok(term.includes('COMPLIANT'));
    assert.ok(term.includes('BROWSER COMPATIBILITY SUMMARY'));
    assert.ok(term.includes('+39 vers headroom'));
    assert.ok(!term.includes('Chrome all'), 'Must not contain "Chrome all"');
  });
});

import { CompatDatabase } from '../src/data/compat-db.js';
import { JsScanner } from '../src/scanners/js.js';
import { IGNORED_DIRS } from '../src/adapters/output-detector.js';

describe('Source attribution & directory exclusion tests', () => {
  it('correctly attributes origin to app code vs vendor dependencies', () => {
    const db = new CompatDatabase();
    const scanner = new JsScanner(db);

    const appCode = `const x = a?.b;`;
    const appFindings = scanner.scan(appCode, 'src/components/Modal.js');
    assert.equal(appFindings[0].origin, 'app');

    const vendorFindings = scanner.scan(appCode, 'dist/chunks/vendor-lucide.js');
    assert.equal(vendorFindings[0].origin, 'vendor');
  });

  it('safeguards against repository pollution by ignoring dangerous directories', () => {
    assert.ok(IGNORED_DIRS.has('.pnpm-store'));
    assert.ok(IGNORED_DIRS.has('node_modules'));
    assert.ok(IGNORED_DIRS.has('.git'));
  });
});
