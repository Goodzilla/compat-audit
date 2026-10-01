import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { CompatDatabase } from '../src/data/compat-db.js';
import { JsScanner } from '../src/scanners/js.js';
import { auditSingleProject } from '../src/index.js';
import { detectRuntimePolyfillsInVm } from '../src/adapters/polyfills.js';

describe('Runtime VM Polyfill Detection Engine', () => {
  const compatDb = new CompatDatabase();
  const scanner = new JsScanner(compatDb);

  it('detects runtime polyfills via node:vm sandbox by comparing prototype references and [native code]', () => {
    // Compiled bundle chunk that polyfills .at() and Object.hasOwn
    const compiledChunk = `
      Array.prototype.at = function(n) {
        n = Math.trunc(n) || 0;
        if (n < 0) n += this.length;
        return this[n];
      };

      Object.hasOwn = function(o, p) {
        return Object.prototype.hasOwnProperty.call(o, p);
      };
    `;

    const runtimeExtracted = detectRuntimePolyfillsInVm(compiledChunk, 'assets/vendor-polyfills.js', compatDb);
    const keys = Array.from(runtimeExtracted.keys());

    assert.ok(keys.includes('javascript.builtins.Array.at'), 'Must detect runtime Array.prototype.at');
    assert.ok(keys.includes('javascript.builtins.Object.hasOwn'), 'Must detect runtime Object.hasOwn');

    const atEntry = runtimeExtracted.get('javascript.builtins.Array.at');
    assert.equal(atEntry.runtimeVerified, true);
    assert.equal(atEntry.originChunk, 'assets/vendor-polyfills.js');
  });

  it('detects polyfills declared via Object.defineProperty and Reflect.defineProperty in VM', () => {
    const jsCode = `
      Object.defineProperty(Array.prototype, 'toSorted', {
        value: function(fn) { return [...this].sort(fn); },
        writable: true,
        configurable: true
      });

      Reflect.defineProperty(Object, 'hasOwn', {
        value: function(obj, prop) { return Object.prototype.hasOwnProperty.call(obj, prop); }
      });
    `;

    const runtimeExtracted = detectRuntimePolyfillsInVm(jsCode, 'polyfills.js', compatDb);
    const keys = Array.from(runtimeExtracted.keys());

    assert.ok(keys.includes('javascript.builtins.Array.toSorted'), 'Must extract toSorted from defineProperty in VM');
    assert.ok(keys.includes('javascript.builtins.Object.hasOwn'), 'Must extract hasOwn from defineProperty in VM');
  });

  it('detects global Web API polyfills (crypto.randomUUID, structuredClone) in VM', () => {
    const jsCode = `
      if (typeof crypto !== 'undefined') {
        crypto.randomUUID = function() {
          return '10000000-1000-4000-8000-100000000000';
        };
      }
      window.structuredClone = function(obj) {
        return JSON.parse(JSON.stringify(obj));
      };
    `;

    const runtimeExtracted = detectRuntimePolyfillsInVm(jsCode, 'polyfills.js', compatDb);
    const keys = Array.from(runtimeExtracted.keys());

    assert.ok(keys.includes('api.Crypto.randomUUID'), 'Must detect crypto.randomUUID in VM');
    assert.ok(keys.includes('api.structuredClone'), 'Must detect structuredClone in VM');
  });

  it('shares bundle-wide runtime polyfills across independent chunks', () => {
    // Chunk 1: defines polyfills at app bootstrap
    const chunk1Bootstrap = `
      if (!Array.prototype.toSorted) {
        Array.prototype.toSorted = function(fn) { return [...this].sort(fn); };
      }
      if (!Object.hasOwn) {
        Object.hasOwn = function(o, p) { return Object.prototype.hasOwnProperty.call(o, p); };
      }
    `;

    // Chunk 2: uses .toSorted() and Object.hasOwn in a page component without local polyfill
    const chunk2Component = `
      export function sortItems(items) {
        return items.toSorted();
      }
      export function checkProp(obj, key) {
        return Object.hasOwn(obj, key);
      }
    `;

    // Without polyfill keys: chunk 2 fails with BLOCKING gaps
    const findingsWithout = scanner.scan(chunk2Component, 'page.chunk.js');
    const keysWithout = findingsWithout.map(f => f.featureKey);
    assert.ok(keysWithout.includes('javascript.builtins.Array.toSorted'));
    assert.ok(keysWithout.includes('javascript.builtins.Object.hasOwn'));

    // Detect from chunk 1 in VM
    const detectedInVm = detectRuntimePolyfillsInVm(chunk1Bootstrap, 'vendor.chunk.js', compatDb);
    const bundlePolyfills = new Set(Array.from(detectedInVm.keys()));
    bundlePolyfills.add('toSorted');
    bundlePolyfills.add('hasOwn');

    const findingsWith = scanner.scan(chunk2Component, 'page.chunk.js', null, bundlePolyfills);
    const keysWith = findingsWith.map(f => f.featureKey);
    assert.ok(!keysWith.includes('javascript.builtins.Array.toSorted'), 'toSorted must be whitelisted');
    assert.ok(!keysWith.includes('javascript.builtins.Object.hasOwn'), 'Object.hasOwn must be whitelisted');
  });

  it('integrates runtime VM polyfill detection seamlessly into auditSingleProject', async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'compat-audit-vm-'));
    try {
      // Create package.json with declared browsers
      fs.writeFileSync(
        path.join(tmpDir, 'package.json'),
        JSON.stringify({
          name: 'test-app',
          browserslist: ['defaults', 'Chrome >= 80', 'Safari >= 13.1']
        }),
        'utf-8'
      );

      // Create dist/ containing compiled chunks: vendor chunk defines runtime polyfills
      const distDir = path.join(tmpDir, 'dist');
      fs.mkdirSync(distDir, { recursive: true });
      fs.writeFileSync(
        path.join(distDir, 'vendor.js'),
        `
        if (!Array.prototype.toSorted) {
          Array.prototype.toSorted = function(fn) { return [...this].sort(fn); };
        }
        if (!Object.hasOwn) {
          Object.hasOwn = function(o, p) { return Object.prototype.hasOwnProperty.call(o, p); };
        }
        `,
        'utf-8'
      );

      // App chunk uses modern features
      fs.writeFileSync(
        path.join(distDir, 'app.js'),
        `
        const list = [3, 1, 2].toSorted();
        const has = Object.hasOwn({ a: 1 }, 'a');
        `,
        'utf-8'
      );

      const report = await auditSingleProject({ cwd: tmpDir, dir: distDir });

      // Must be compliant because toSorted and hasOwn were detected in bundle chunks via VM
      assert.equal(report.verdict, 'COMPLIANT');
      assert.equal(report.issues.length, 0);
      assert.ok(report.detectedPolyfills.length >= 2, 'Must record detected polyfills');
      const polyKeys = report.detectedPolyfills.map(p => p.featureKey);
      assert.ok(polyKeys.includes('javascript.builtins.Array.toSorted'));
      assert.ok(polyKeys.includes('javascript.builtins.Object.hasOwn'));
      assert.equal(report.detectedPolyfills[0].runtimeVerified, true);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
