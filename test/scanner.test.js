import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CompatDatabase } from '../src/data/compat-db.js';
import { JsScanner } from '../src/scanners/js.js';
import { CssScanner } from '../src/scanners/css.js';
import { HtmlScanner } from '../src/scanners/html.js';
import { scoreIssue } from '../src/scoring/effort.js';

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

  it('scores issues accurately according to effort taxonomy', () => {
    const issue1 = scoreIssue('api.structuredClone', 'structuredClone()', 'api', {}, null);
    assert.equal(issue1.effort, 1, 'structuredClone should be Effort 1 (trivial quick-win polyfill)');
    assert.ok(issue1.remediation.includes('@ungap/structured-clone'));

    const issue2 = scoreIssue('javascript.operators.optional_chaining', 'Optional chaining', 'syntax', {}, null);
    assert.equal(issue2.effort, 2, 'Syntax downleveling should be Effort 2 (bundler config)');

    const issue3 = scoreIssue('css.selectors.has', ':has()', 'selector', {}, null);
    assert.equal(issue3.effort, 4, ':has() should be Effort 4 (structural refactor)');
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
    const quirkScore = scoreIssue('safari.css.backdrop-filter-prefix', 'Missing -webkit-backdrop-filter', 'safari-quirk', {}, null);
    assert.equal(quirkScore.effort, 1);
    assert.ok(quirkScore.remediation.includes('-webkit-backdrop-filter'));
  });
});
