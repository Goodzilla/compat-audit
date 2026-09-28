import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { CompatDatabase } from '../src/data/compat-db.js';
import { JsScanner } from '../src/scanners/js.js';

describe('Semantic AST Scope, Guard & Polyfill Tests', () => {
  const db = new CompatDatabase();
  const scanner = new JsScanner(db);

  it('ignores local variables, parameters, and imports named after global APIs', () => {
    const code = `
      // 1. Parameter named structuredClone
      function cloneHelper(structuredClone) {
        return structuredClone;
      }

      // 2. Local variable named ResizeObserver
      function observerHelper() {
        const ResizeObserver = class LocalObserver {};
        return new ResizeObserver();
      }

      // 3. Object property key named structuredClone
      const config = { structuredClone: false };

      // 4. Method on custom object
      const myObj = {
        structuredClone() { return 42; }
      };
      myObj.structuredClone();
    `;

    const findings = scanner.scan(code, 'app.js');
    const keys = findings.map(f => f.featureKey);

    assert.ok(!keys.includes('api.structuredClone'), 'Local structuredClone must not trigger compatibility gap');
    assert.ok(!keys.includes('api.ResizeObserver'), 'Local ResizeObserver must not trigger compatibility gap');
  });

  it('detects feature guards (typeof and "in" operator) without false positives', () => {
    const code = `
      if (typeof structuredClone !== 'undefined') {
        console.log('structuredClone is supported');
      }

      if ('ResizeObserver' in window) {
        console.log('ResizeObserver is supported');
      }
    `;

    const findings = scanner.scan(code, 'app.js');
    const keys = findings.map(f => f.featureKey);

    assert.ok(!keys.includes('api.structuredClone'), 'Guarded typeof check must not trigger compatibility gap');
    assert.ok(!keys.includes('api.ResizeObserver'), 'Guarded "in" operator check must not trigger compatibility gap');
  });

  it('detects existing polyfills in bundle and avoids flagging their own code', () => {
    const code = `
      // Polyfill definition for Object.hasOwn
      if (!Object.hasOwn) {
        Object.hasOwn = (obj, prop) => Object.prototype.hasOwnProperty.call(obj, prop);
      }

      // Polyfill definition for window.ResizeObserver
      if (typeof window !== 'undefined' && !window.ResizeObserver) {
        window.ResizeObserver = class PolyfillRO {};
      }

      // Polyfill definition for Array.prototype.at
      if (!Array.prototype.at) {
        Array.prototype.at = function(n) { return this[n]; };
      }

      // Usages after polyfill
      const isOwn = Object.hasOwn({ a: 1 }, 'a');
      const ro = new ResizeObserver(() => {});
      const item = [1, 2, 3].at(0);
    `;

    const findings = scanner.scan(code, 'bundle-with-polyfills.js');
    const keys = findings.map(f => f.featureKey);

    assert.ok(!keys.includes('javascript.builtins.Object.hasOwn'), 'Polyfilled Object.hasOwn should not trigger gap');
    assert.ok(!keys.includes('api.ResizeObserver'), 'Polyfilled ResizeObserver should not trigger gap');
    assert.ok(!keys.includes('javascript.builtins.Array.at'), 'Polyfilled Array.prototype.at should not trigger gap');
  });

  it('detects genuine unprotected modern Web APIs and prototype methods from BCD', () => {
    const code = `
      const realClone = structuredClone({ test: 123 });
      const stream = new CompressionStream('gzip');
      const sorted = [3, 1, 2].toSorted();
      const last = [10, 20, 30].findLast(x => x > 15);
    `;

    const findings = scanner.scan(code, 'unprotected.js');
    const keys = findings.map(f => f.featureKey);

    assert.ok(keys.includes('api.structuredClone'), 'Must detect unprotected structuredClone');
    assert.ok(keys.includes('api.CompressionStream'), 'Must detect unprotected CompressionStream from dynamic BCD');
    assert.ok(keys.includes('javascript.builtins.Array.toSorted'), 'Must detect unprotected Array.prototype.toSorted from dynamic BCD');
    assert.ok(keys.includes('javascript.builtins.Array.findLast'), 'Must detect unprotected Array.prototype.findLast from dynamic BCD');
  });

  it('extracts source files and vendor packages from source maps when available', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'compat-sourcemap-test-'));
    const bundlePath = path.join(tmpDir, 'chunk-vendor.js');
    const mapPath = bundlePath + '.map';

    const mapContent = JSON.stringify({
      version: 3,
      sources: [
        '../../src/App.tsx',
        '../../node_modules/lucide-react/dist/esm/icons/check.js'
      ]
    });

    fs.writeFileSync(bundlePath, 'const x = structuredClone({ a: 1 });', 'utf-8');
    fs.writeFileSync(mapPath, mapContent, 'utf-8');

    const findings = scanner.scan('const x = structuredClone({ a: 1 });', 'chunk-vendor.js', bundlePath);
    assert.equal(findings.length, 1);
    assert.ok(findings[0].vendorPackages.includes('lucide-react'));

    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});
