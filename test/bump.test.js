import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { determineBumpType, incrementVersion } from '../scripts/bump-version.js';

describe('SemVer automatic bump logic tests', () => {
  it('correctly identifies patch bumps', () => {
    assert.equal(determineBumpType('fix: handle edge case in CSS parser'), 'patch');
    assert.equal(determineBumpType('refactor: optimize token lookups'), 'patch');
    assert.equal(determineBumpType('docs: update README with examples'), 'patch');
    assert.equal(determineBumpType('chore: update dependencies'), 'patch');
    assert.equal(determineBumpType('random commit message'), 'patch');
  });

  it('correctly identifies minor bumps (features)', () => {
    assert.equal(determineBumpType('feat: add support for modern HTML attributes'), 'minor');
    assert.equal(determineBumpType('feat(cli): add --markdown flag'), 'minor');
  });

  it('correctly identifies major bumps (breaking changes)', () => {
    assert.equal(determineBumpType('feat!: change return signature of auditBundle'), 'major');
    assert.equal(determineBumpType('fix!: remove deprecated config option'), 'major');
    assert.equal(determineBumpType('refactor: rework API\n\nBREAKING CHANGE: drop node 16'), 'major');
    assert.equal(determineBumpType('chore: update engine\n\nBREAKING-CHANGE: requires node 18'), 'major');
  });

  it('calculates the next semver correctly', () => {
    assert.equal(incrementVersion('1.0.0', 'patch'), '1.0.1');
    assert.equal(incrementVersion('1.0.0', 'minor'), '1.1.0');
    assert.equal(incrementVersion('1.0.0', 'major'), '2.0.0');
    assert.equal(incrementVersion('1.2.3', 'patch'), '1.2.4');
    assert.equal(incrementVersion('1.2.3', 'minor'), '1.3.0');
    assert.equal(incrementVersion('1.2.3', 'major'), '2.0.0');
  });
});
