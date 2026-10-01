import { describe, it } from 'node:test';
import assert from 'node:assert';
import { REMEDIATION_CATALOG, getOptimizationForFeature } from '../src/optimization/playbook.js';

describe('Remediation playbook and senior optimization catalog', () => {
  it('returns optimization metadata for recognized features', () => {
    const arrayAt = getOptimizationForFeature('javascript.builtins.Array.at');
    assert.ok(arrayAt);
    assert.strictEqual(arrayAt.strategy, 'inline_shim');
    assert.ok(arrayAt.appAdvice);
    assert.ok(arrayAt.vendorAdvice);
    assert.strictEqual(arrayAt.costKb, 0.1);

    const structuredClone = getOptimizationForFeature('api.structuredClone');
    assert.ok(structuredClone);
    assert.strictEqual(structuredClone.strategy, 'package');
    assert.strictEqual(structuredClone.pkg, '@ungap/structured-clone');
    assert.ok(Array.isArray(structuredClone.decisionOptions));
    assert.strictEqual(structuredClone.decisionOptions.length, 3);
  });

  it('provides bundler_target strategy for modern syntax features', () => {
    const optChain = getOptimizationForFeature('javascript.operators.optional_chaining');
    assert.ok(optChain);
    assert.strictEqual(optChain.strategy, 'bundler_target');
    assert.strictEqual(optChain.costKb, 0);
  });

  it('provides progressive_css and structural strategies for CSS features', () => {
    const backdrop = getOptimizationForFeature('safari.css.backdrop-filter-prefix');
    assert.ok(backdrop);
    assert.strictEqual(backdrop.strategy, 'progressive_css');

    const hasSelector = getOptimizationForFeature('css.selectors.has');
    assert.ok(hasSelector);
    assert.strictEqual(hasSelector.strategy, 'structural');
  });

  it('returns null for unknown feature keys', () => {
    const unknown = getOptimizationForFeature('nonexistent.feature.key');
    assert.strictEqual(unknown, null);
  });
});
