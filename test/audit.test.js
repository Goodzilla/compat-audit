import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CompatDatabase, BASELINE_STANDARDS } from '../src/data/compat-db.js';
import { JsScanner } from '../src/scanners/js.js';
import { CssScanner } from '../src/scanners/css.js';
import { formatTerminalReport } from '../src/formatters/terminal.js';
import { formatMarkdownReport } from '../src/formatters/markdown.js';

describe('Compat Database', () => {
  it('loads BCD and indexes globals and builtins', () => {
    const db = new CompatDatabase();
    assert.ok(db.lookupGlobal('ResizeObserver'), 'ResizeObserver should be indexed');
    assert.ok(db.lookupGlobal('structuredClone'), 'structuredClone should be indexed');
    assert.ok(db.lookupPrototype('at'), 'Array.at should be indexed as prototype method');
    assert.ok(db.lookupStatic('Object', 'hasOwn'), 'Object.hasOwn should be indexed as static method');
  });

  it('filters out universal and ES5 methods to avoid false positive collisions', () => {
    const db = new CompatDatabase();
    assert.equal(db.lookupPrototype('toString'), null);
    assert.equal(db.lookupPrototype('slice'), null);
    assert.equal(db.lookupPrototype('forEach'), null);
    assert.equal(db.lookupPrototype('map'), null);
    assert.equal(db.lookupPrototype('length'), null);
  });

  it('supports parametric region and defaults to global', () => {
    const globalDb = new CompatDatabase();
    assert.equal(globalDb.region, 'global');
    assert.ok(globalDb.stats.chrome);

    const frDb = new CompatDatabase({ region: 'FR' });
    assert.equal(frDb.region, 'FR');
    assert.ok(frDb.stats.chrome);

    const fallbackDb = new CompatDatabase({ region: 'NONEXISTENT_REGION' });
    assert.equal(fallbackDb.region, 'global');
  });
});

describe('Report formatters', () => {
  const mockReportCompliant = {
    targetDir: 'dist',
    totalFiles: 5,
    totalJsFiles: 3,
    totalCssFiles: 2,
    totalHtmlFiles: 0,
    verdict: 'COMPLIANT',
    hasGaps: false,
    region: 'global',
    regionLabel: 'Global',
    coverage: 100,
    measuredCoverage: 100,
    targetCoverage: 100,
    audienceGap: 0,
    audienceLoss: 0,
    browserFloor: { chrome: 51, safari: 10, firefox: 54, edge: 15, ios_saf: 10, chrome_android: 51 },
    browserSummary: [
      {
        browser: 'Chrome',
        platform: 'desktop',
        declaredTarget: 'ES2015',
        targetVersion: 90,
        targetDisplay: 'ES2015 ~ v90+',
        minVersion: 51,
        minVersionStr: 'Chrome 51+',
        status: 'compliant',
        statusLabel: 'Compliant (+39 versions headroom, down to v51+)',
        headroom: 39,
        gap: 0
      },
      {
        browser: 'Safari',
        platform: 'desktop',
        declaredTarget: 'ES2015',
        targetVersion: 14,
        targetDisplay: 'ES2015 ~ v14+',
        minVersion: 10,
        minVersionStr: 'Safari 10+',
        status: 'compliant',
        statusLabel: 'Compliant (+4 versions headroom, down to v10+)',
        headroom: 4,
        gap: 0
      },
      {
        browser: 'iOS Safari',
        platform: 'mobile',
        key: 'ios_saf',
        declaredTarget: 'ES2015',
        targetVersion: 14,
        targetDisplay: 'ES2015 ~ v14+',
        minVersion: 10,
        minVersionStr: 'iOS Safari 10+',
        status: 'compliant',
        statusLabel: 'Compliant (+4 versions headroom, down to v10+)',
        headroom: 4,
        gap: 0
      },
      {
        browser: 'Samsung Internet',
        platform: 'mobile',
        key: 'samsung',
        declaredTarget: 'ES2015',
        targetVersion: 10,
        targetDisplay: 'ES2015 ~ v10+',
        minVersion: 5.0,
        minVersionStr: 'Samsung Internet 5.0+',
        status: 'compliant',
        statusLabel: 'Compliant (+5 versions headroom, down to v5.0+)',
        headroom: 5,
        gap: 0
      }
    ],
    quickWins: [],
    structuralBlockers: [],
    diagnostics: []
  };

  it('generates markdown report with dynamic region and English headers', () => {
    const md = formatMarkdownReport(mockReportCompliant);
    assert.ok(md.includes('## Browser Compatibility Audit Report'));
    assert.ok(md.includes('Status & Headroom'));
    assert.ok(md.includes('Verdict: COMPLIANT'));
    assert.ok(md.includes('+39 vers headroom'));
    assert.ok(md.includes('Target Coverage (Global)'), 'Markdown report must include Target Coverage (Global)');
    assert.ok(md.includes('Measured Coverage (Global)'), 'Markdown report must include Measured Coverage (Global)');
    assert.ok(md.includes('Audience Gap'), 'Markdown report must include Audience Gap');
    assert.ok(md.includes('Platform'), 'Markdown table must include Platform column');
    assert.ok(md.includes('Mobile'), 'Markdown table must show Mobile rows');
    assert.ok(md.includes('Desktop'), 'Markdown table must show Desktop rows');
    assert.ok(md.includes('ES2015 ~ v90+'), 'Markdown report must display corresponding browser version for standard targets');
    assert.ok(md.includes('https://github.com/Goodzilla/compat-audit'), 'Markdown must link to GitHub repo');
  });

  it('generates terminal report with English terms and coverage triptyque', () => {
    const term = formatTerminalReport(mockReportCompliant);
    assert.ok(term.includes('COMPLIANT'));
    assert.ok(term.includes('BROWSER COMPATIBILITY SUMMARY'));
    assert.ok(term.includes('+39 vers headroom'));
    assert.ok(term.includes('Target Coverage (Global):'), 'Terminal report must show Target Coverage (Global)');
    assert.ok(term.includes('Measured Coverage (Global):'), 'Terminal report must show Measured Coverage (Global)');
    assert.ok(term.includes('Audience Gap:'), 'Terminal report must show Audience Gap');
    assert.ok(term.includes('[Mobile]'), 'Terminal report must show [Mobile] badge');
    assert.ok(term.includes('[Desk]'), 'Terminal report must show [Desk] badge');
    assert.ok(!term.includes('Chrome all'), 'Must not contain "Chrome all"');
    assert.ok(term.includes('target: ES2015 ~ v90+'), 'Terminal report must display corresponding browser version for standard targets');
  });

  it('formats audience gap correctly for drift vs target and positive headroom', () => {
    const reportWithGap = {
      ...mockReportCompliant,
      hasGaps: true,
      targetCoverage: 99.9,
      measuredCoverage: 92.3,
      audienceGap: -7.6,
      audienceLoss: 7.6
    };
    const termGap = formatTerminalReport(reportWithGap);
    assert.ok(termGap.includes('-7.6% (Drift vs target)'), 'Terminal should format negative audience gap as drift');
    const mdGap = formatMarkdownReport(reportWithGap);
    assert.ok(mdGap.includes('-7.6%** (Drift vs target)'), 'Markdown should format negative audience gap as drift');

    const reportWithHeadroom = {
      ...mockReportCompliant,
      hasGaps: false,
      targetCoverage: 95.0,
      measuredCoverage: 99.0,
      audienceGap: 4.0,
      audienceLoss: 0
    };
    const termHeadroom = formatTerminalReport(reportWithHeadroom);
    assert.ok(termHeadroom.includes('+4% (Exceeds target)'), 'Terminal should format positive headroom');
    const mdHeadroom = formatMarkdownReport(reportWithHeadroom);
    assert.ok(mdHeadroom.includes('+4%** (Exceeds target)'), 'Markdown should format positive headroom');
  });

  it('does not duplicate version when target already specifies browser version', () => {
    const reportWithBrowserTarget = {
      ...mockReportCompliant,
      browserSummary: [
        {
          browser: 'Chrome',
          platform: 'desktop',
          declaredTarget: 'Chrome 90+',
          targetVersion: 90,
          targetDisplay: 'Chrome 90+',
          minVersion: 51,
          minVersionStr: 'Chrome 51+',
          status: 'compliant',
          statusLabel: 'Compliant (+39 versions headroom, down to v51+)',
          headroom: 39,
          gap: 0
        }
      ]
    };
    const term = formatTerminalReport(reportWithBrowserTarget);
    assert.ok(term.includes('target: Chrome 90+'));
    assert.ok(!term.includes('Chrome 90+ ~ v90+'));
  });
});

describe('AST Scanners', () => {
  it('scans modern JS features and ignores guarded code', () => {
    const db = new CompatDatabase();
    const scanner = new JsScanner(db);

    const code = `
      const x = structuredClone({ a: 1 });
      const item = [1, 2].at(0);
      if (typeof ResizeObserver !== 'undefined') {
        new ResizeObserver(() => {});
      }
    `;

    const findings = scanner.scan(code, 'bundle.js');
    const keys = findings.map(f => f.featureKey);

    assert.ok(keys.includes('api.structuredClone'), 'Should detect unguarded structuredClone');
    assert.ok(keys.includes('javascript.builtins.Array.at'), 'Should detect Array.prototype.at');
    assert.ok(!keys.includes('api.ResizeObserver'), 'Should NOT detect guarded ResizeObserver');
  });

  it('scans modern CSS features', () => {
    const db = new CompatDatabase();
    const scanner = new CssScanner(db);

    const css = `
      .card:has(.active) {
        color: light-dark(#fff, #000);
      }
    `;

    const findings = scanner.scan(css, 'style.css');
    const keys = findings.map(f => f.featureKey);

    assert.ok(keys.includes('css.selectors.has'), 'Should detect :has()');
    assert.ok(keys.includes('css.types.color.light-dark'), 'Should detect light-dark()');
  });
});

describe('Audience coverage tests', () => {
  it('calculates global audience coverage', () => {
    const db = new CompatDatabase({ region: 'global' });
    const modernFloor = { chrome: 120, safari: 17, firefox: 120, edge: 120, ios_saf: 17, chrome_android: 120, samsung: 23 };
    const cov = db.calculateCoverage(modernFloor);
    assert.ok(typeof cov === 'number' && cov > 0 && cov <= 100);
  });

  it('calculates France audience coverage using caniuse FR regional data', () => {
    const db = new CompatDatabase({ region: 'FR' });
    const modernFloor = { chrome: 120, safari: 17, firefox: 120, edge: 120, ios_saf: 17, chrome_android: 120, samsung: 23 };
    const frCoverage = db.calculateCoverage(modernFloor);
    assert.ok(typeof frCoverage === 'number' && frCoverage > 0 && frCoverage <= 100);
  });

  it('correctly maps evergreen mobile version "0" in calculateCoverage', () => {
    const db = new CompatDatabase();
    const es2015 = BASELINE_STANDARDS.es2015;
    const globalCov = db.calculateCoverage(es2015);
    assert.ok(globalCov >= 99.0, `ES2015 global coverage should be >= 99%, got ${globalCov}%`);
  });
});
