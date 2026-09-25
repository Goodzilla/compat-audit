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
    assert.equal(es2015.samsung, 5.0);

    const es2020 = getBaselineSupport('es2020');
    assert.equal(es2020.chrome, 80);
    assert.equal(es2020.safari, 13.1);
    assert.equal(es2020.samsung, 13.0);

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
        platform: 'desktop',
        declaredTarget: 'ES2015',
        targetVersion: 14,
        minVersion: 10,
        minVersionStr: 'Safari 10+',
        status: 'compliant',
        statusLabel: '✅ Compliant (+4 versions headroom, down to v10+)',
        headroom: 4,
        gap: 0
      },
      {
        key: 'ios_saf',
        browser: 'iOS Safari',
        platform: 'mobile',
        declaredTarget: 'ES2015',
        targetVersion: 14,
        minVersion: 10,
        minVersionStr: 'iOS Safari 10+',
        status: 'compliant',
        statusLabel: '✅ Compliant (+4 versions headroom, down to v10+)',
        headroom: 4,
        gap: 0
      },
      {
        key: 'samsung',
        browser: 'Samsung Internet',
        platform: 'mobile',
        declaredTarget: 'ES2015',
        targetVersion: 10,
        minVersion: 5.0,
        minVersionStr: 'Samsung Internet 5.0+',
        status: 'compliant',
        statusLabel: '✅ Compliant (+5 versions headroom, down to v5.0+)',
        headroom: 5,
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
    assert.ok(md.includes('Platform'), 'Markdown table must include Platform column');
    assert.ok(md.includes('Mobile'), 'Markdown table must show Mobile rows');
    assert.ok(md.includes('Desktop'), 'Markdown table must show Desktop rows');
    assert.ok(!md.includes('Chrome all'), 'Must not contain "Chrome all"');
  });

  it('generates terminal report with English terms', () => {
    const term = formatTerminalReport(mockReportCompliant);
    assert.ok(term.includes('COMPLIANT'));
    assert.ok(term.includes('BROWSER COMPATIBILITY SUMMARY'));
    assert.ok(term.includes('+39 vers headroom'));
    assert.ok(term.includes('[Mobile]'), 'Terminal report must show [Mobile] badge');
    assert.ok(term.includes('[Desk]'), 'Terminal report must show [Desk] badge');
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

    // Windows backslash path resilience
    const windowsVendorFindings = scanner.scan(appCode, 'dist\\chunks\\vendor-lucide.js');
    assert.equal(windowsVendorFindings[0].origin, 'vendor', 'Windows backslash path must be recognized as vendor');
  });

  it('safeguards against repository pollution by ignoring dangerous directories', () => {
    assert.ok(IGNORED_DIRS.has('.pnpm-store'));
    assert.ok(IGNORED_DIRS.has('node_modules'));
    assert.ok(IGNORED_DIRS.has('.git'));
  });
});

import { CssScanner } from '../src/scanners/css.js';

describe('Baseline 2024 web features tests', () => {
  const db = new CompatDatabase();
  const jsScanner = new JsScanner(db);
  const cssScanner = new CssScanner(db);

  it('detects Promise.withResolvers and Object.groupBy', () => {
    const code = `
      const { promise, resolve } = Promise.withResolvers();
      const grouped = Object.groupBy([1, 2, 3], x => x % 2);
      const setDiff = setA.union(setB);
    `;
    const findings = jsScanner.scan(code, 'app.js');
    const keys = findings.map(f => f.featureKey);

    assert.ok(keys.includes('javascript.builtins.Promise.withResolvers'), 'Should detect Promise.withResolvers');
    assert.ok(keys.includes('javascript.builtins.Object.groupBy'), 'Should detect Object.groupBy');
    assert.ok(keys.includes('javascript.builtins.Set.union'), 'Should detect Set.prototype.union');
  });

  it('detects CSS light-dark() color function', () => {
    const css = `.theme { color: light-dark(#333, #fff); }`;
    const findings = cssScanner.scan(css, 'style.css');
    const keys = findings.map(f => f.featureKey);

    assert.ok(keys.includes('css.types.color.light-dark'), 'Should detect light-dark()');
  });
});
