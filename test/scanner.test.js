import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CompatDatabase } from '../src/data/compat-db.js';
import { JsScanner } from '../src/scanners/js.js';
import { CssScanner } from '../src/scanners/css.js';
import { HtmlScanner } from '../src/scanners/html.js';
import {
  evaluateSeverity,
  normalizeThreshold,
  meetsThreshold,
  evaluateCiThreshold
} from '../src/scoring/severity.js';

describe('compat-audit core engine tests', () => {
  const db = new CompatDatabase();
  const jsScanner = new JsScanner(db);
  const cssScanner = new CssScanner(db);
  const htmlScanner = new HtmlScanner(db);

  it('detects runtime JS Web APIs and prototype methods', () => {
    const code = `
      const clone = structuredClone({ a: 1 });
      const uuid = crypto.randomUUID();
      const last = [1, 2, 3].at(-1);
      const own = Object.hasOwn({}, "prop");
    `;

    const findings = jsScanner.scan(code, 'bundle.js');
    const keys = findings.map(f => f.featureKey);

    assert.ok(keys.includes('api.structuredClone'), 'Should detect structuredClone');
    assert.ok(keys.includes('api.Crypto.randomUUID'), 'Should detect crypto.randomUUID');
    assert.ok(keys.includes('javascript.builtins.Array.at'), 'Should detect Array.prototype.at');
    assert.ok(keys.includes('javascript.builtins.Object.hasOwn'), 'Should detect Object.hasOwn');
  });

  it('detects modern JS syntax', () => {
    const code = `
      const val = a?.b ?? 42;
      let x = 1;
      x ??= 2;
    `;

    const findings = jsScanner.scan(code, 'bundle.js');
    const keys = findings.map(f => f.featureKey);

    assert.ok(keys.includes('javascript.operators.optional_chaining'));
    assert.ok(keys.includes('javascript.operators.nullish_coalescing'));
    assert.ok(keys.includes('javascript.operators.nullish_coalescing_assignment'));
  });

  it('detects modern CSS selectors, at-rules and properties', () => {
    const css = `
      .card:has(img) { color: color-mix(in srgb, red, blue); }
      @container (min-width: 400px) { .box { aspect-ratio: 16 / 9; } }
      .nav & { display: block; }
    `;

    const findings = cssScanner.scan(css, 'bundle.css');
    const keys = findings.map(f => f.featureKey);

    assert.ok(keys.includes('css.selectors.has'), 'Should detect :has()');
    assert.ok(keys.includes('css.types.color.color-mix'), 'Should detect color-mix()');
    assert.ok(keys.includes('css.at-rules.container'), 'Should detect @container');
    assert.ok(keys.includes('css.selectors.nesting'), 'Should detect CSS nesting');
  });

  it('detects modern HTML attributes and tags', () => {
    const html = `
      <dialog id="modal"></dialog>
      <div popover>Menu</div>
      <img src="pic.jpg" loading="lazy" />
    `;

    const findings = htmlScanner.scan(html, 'index.html');
    const keys = findings.map(f => f.featureKey);

    assert.ok(keys.includes('html.elements.dialog'));
    assert.ok(keys.includes('html.global_attributes.popover'));
    assert.ok(keys.includes('html.elements.img.loading'));
  });

  it('evaluates compatibility issues according to CI/Sec severity scale (BLOCKING, HIGH, MEDIUM, LOW)', () => {
    // 1. BLOCKING: Syntax error
    const syntaxIssue = evaluateSeverity({
      featureKey: 'javascript.operators.optional_chaining',
      name: 'Optional chaining',
      category: 'syntax'
    });
    assert.equal(syntaxIssue.severity, 'BLOCKING');
    assert.equal(syntaxIssue.impactType, 'SyntaxError (Script parse error)');

    // 2. BLOCKING: Prototype method (TypeError)
    const protoIssue = evaluateSeverity({
      featureKey: 'javascript.builtins.Array.at',
      name: 'Array.prototype.at()',
      category: 'prototype'
    });
    assert.equal(protoIssue.severity, 'BLOCKING');
    assert.equal(protoIssue.impactType, 'TypeError (Undefined method)');

    // 3. HIGH: Global API missing (ReferenceError)
    const apiIssue = evaluateSeverity({
      featureKey: 'api.structuredClone',
      name: 'structuredClone()',
      category: 'api'
    });
    assert.equal(apiIssue.severity, 'HIGH');
    assert.equal(apiIssue.impactType, 'ReferenceError (Missing API)');

    // 4. MEDIUM: Modern CSS layout / selectors
    const cssIssue = evaluateSeverity({
      featureKey: 'css.selectors.has',
      name: ':has()',
      category: 'css'
    });
    assert.equal(cssIssue.severity, 'MEDIUM');
    assert.equal(cssIssue.impactType, 'Ignored CSS (Layout degradation)');

    // 5. LOW: Safari quirk / vendor prefix
    const quirkIssue = evaluateSeverity({
      featureKey: 'safari.css.backdrop-filter-prefix',
      name: 'Missing -webkit-backdrop-filter',
      category: 'css'
    });
    assert.equal(quirkIssue.severity, 'LOW');
    assert.equal(quirkIssue.impactType, 'Visual Glitch (Prefix missing)');
  });

  it('detects Safari and WebKit visual quirks and rendering traps in CSS', () => {
    const css = `
      .glass {
        backdrop-filter: blur(10px);
      }
      .fullscreen {
        height: 100vh;
      }
      .card-media {
        flex: 1;
        aspect-ratio: 16 / 9;
      }
      .sticky-header {
        position: sticky;
        overflow: hidden;
      }
      .clamped {
        line-clamp: 2;
      }
      input.search {
        border-radius: 8px;
        background: white;
      }
      html {
        text-size-adjust: 100%;
      }
    `;

    const findings = cssScanner.scan(css, 'safari-test.css');
    const keys = findings.map(f => f.featureKey);

    assert.ok(keys.includes('safari.css.backdrop-filter-prefix'), 'Should detect missing -webkit-backdrop-filter');
    assert.ok(keys.includes('safari.css.100vh-viewport'), 'Should detect 100vh viewport unit without dvh');
    assert.ok(keys.includes('safari.css.aspect-ratio-flex'), 'Should detect aspect-ratio on flex item');
    assert.ok(keys.includes('safari.css.sticky-overflow-trap'), 'Should detect sticky combined with overflow');
    assert.ok(keys.includes('safari.css.line-clamp-prefix'), 'Should detect un-prefixed line-clamp');
    assert.ok(keys.includes('safari.css.appearance-none'), 'Should detect form control without appearance: none');
    assert.ok(keys.includes('safari.css.text-size-adjust'), 'Should detect text-size-adjust without -webkit-');

    // Test scoring for Safari quirks
    const quirkScore = evaluateSeverity({
      featureKey: 'safari.css.backdrop-filter-prefix',
      name: 'Missing -webkit-backdrop-filter',
      category: 'css'
    });
    assert.equal(quirkScore.severity, 'LOW');
    assert.equal(quirkScore.impactType, 'Visual Glitch (Prefix missing)');
  });

  it('evaluates CI threshold helpers and severity comparison logic', () => {
    // 1. normalizeThreshold
    assert.equal(normalizeThreshold('blocking'), 'BLOCKING');
    assert.equal(normalizeThreshold('HIGH'), 'HIGH');
    assert.equal(normalizeThreshold('Medium'), 'MEDIUM');
    assert.equal(normalizeThreshold('low'), 'LOW');
    assert.equal(normalizeThreshold(null), null);
    assert.throws(() => normalizeThreshold('invalid'), /Invalid threshold/);

    // 2. meetsThreshold
    assert.equal(meetsThreshold('BLOCKING', 'BLOCKING'), true);
    assert.equal(meetsThreshold('BLOCKING', 'HIGH'), true);
    assert.equal(meetsThreshold('BLOCKING', 'LOW'), true);
    assert.equal(meetsThreshold('HIGH', 'BLOCKING'), false);
    assert.equal(meetsThreshold('HIGH', 'HIGH'), true);
    assert.equal(meetsThreshold('MEDIUM', 'HIGH'), false);
    assert.equal(meetsThreshold('LOW', 'MEDIUM'), false);
    assert.equal(meetsThreshold('LOW', 'LOW'), true);

    // 3. evaluateCiThreshold
    const issues = [
      { name: 'Array.at', severity: 'BLOCKING', causesGap: true },
      { name: 'structuredClone', severity: 'HIGH', causesGap: true },
      { name: ':has()', severity: 'MEDIUM', causesGap: false }, // Compliant feature, no gap
      { name: '-webkit-prefix', severity: 'LOW', causesGap: true }
    ];

    // Threshold = BLOCKING: only Array.at fails
    const resBlocking = evaluateCiThreshold(issues, 'BLOCKING');
    assert.equal(resBlocking.passed, false);
    assert.equal(resBlocking.failingIssuesCount, 1);
    assert.equal(resBlocking.failingIssues[0].name, 'Array.at');

    // Threshold = HIGH: Array.at and structuredClone fail
    const resHigh = evaluateCiThreshold(issues, 'HIGH');
    assert.equal(resHigh.passed, false);
    assert.equal(resHigh.failingIssuesCount, 2);

    // If only non-gap issues or lower severity exist:
    const compliantIssues = [
      { name: 'Promise.withResolvers', severity: 'BLOCKING', causesGap: false },
      { name: '-webkit-prefix', severity: 'LOW', causesGap: true }
    ];
    const resCompliant = evaluateCiThreshold(compliantIssues, 'BLOCKING');
    assert.equal(resCompliant.passed, true);
    assert.equal(resCompliant.failingIssuesCount, 0);

    // No threshold: always passes
    const resNone = evaluateCiThreshold(issues, null);
    assert.equal(resNone.passed, true);
  });
});
