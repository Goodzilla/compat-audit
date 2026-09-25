import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initSkills } from '../src/commands/init.js';

describe('AI Agent Skills Scaffolder (initSkills)', () => {
  it('scaffolds compat-audit and compat-optimize skills into target workspace', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'compat-audit-test-'));

    try {
      const res = initSkills({ cwd: tmpDir });
      assert.strictEqual(res.isGlobal, false);
      assert.strictEqual(res.filesCreated.length, 2);

      const auditSkillFile = path.join(tmpDir, '.agents', 'skills', 'compat-audit', 'SKILL.md');
      const optimizeSkillFile = path.join(tmpDir, '.agents', 'skills', 'compat-optimize', 'SKILL.md');

      assert.ok(fs.existsSync(auditSkillFile), 'compat-audit/SKILL.md should exist');
      assert.ok(fs.existsSync(optimizeSkillFile), 'compat-optimize/SKILL.md should exist');

      const auditContent = fs.readFileSync(auditSkillFile, 'utf-8');
      const optimizeContent = fs.readFileSync(optimizeSkillFile, 'utf-8');

      assert.ok(auditContent.includes('name: compat-audit'));
      assert.ok(auditContent.includes('NEVER run ad-hoc inline Node scripts'));
      assert.ok(optimizeContent.includes('name: compat-optimize'));
      assert.ok(optimizeContent.includes('disable-model-invocation: true'));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
