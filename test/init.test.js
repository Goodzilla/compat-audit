import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { initSkills, promptScope } from '../src/commands/init.js';

describe('AI Agent Skills Scaffolder (initSkills)', () => {
  it('scaffolds skills into local workspace and creates Claude Code bridge', () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'compat-audit-test-'));

    try {
      const res = initSkills({ cwd: tmpDir });
      assert.strictEqual(res.isGlobal, false);
      assert.ok(res.filesCreated.length >= 4);

      const auditSkillFile = path.join(tmpDir, '.agents', 'skills', 'compat-audit', 'SKILL.md');
      const optimizeSkillFile = path.join(tmpDir, '.agents', 'skills', 'compat-optimize', 'SKILL.md');
      const claudeAuditFile = path.join(tmpDir, '.claude', 'skills', 'compat-audit', 'SKILL.md');
      const claudeOptimizeFile = path.join(tmpDir, '.claude', 'skills', 'compat-optimize', 'SKILL.md');

      assert.ok(fs.existsSync(auditSkillFile), 'compat-audit/SKILL.md should exist in .agents');
      assert.ok(fs.existsSync(optimizeSkillFile), 'compat-optimize/SKILL.md should exist in .agents');
      assert.ok(fs.existsSync(claudeAuditFile), 'compat-audit/SKILL.md should exist in .claude');
      assert.ok(fs.existsSync(claudeOptimizeFile), 'compat-optimize/SKILL.md should exist in .claude');

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

  it('defaults to local in non-interactive environment (promptScope)', async () => {
    const scope = await promptScope();
    assert.strictEqual(scope, 'local');
  });

  it('scaffolds to multiple global targets across all major harnesses', () => {
    const tmpHome = fs.mkdtempSync(path.join(os.tmpdir(), 'compat-audit-home-'));

    try {
      const res = initSkills({ global: true, homeDir: tmpHome });
      assert.strictEqual(res.isGlobal, true);
      assert.ok(res.harnessesSupported.length >= 3);
      assert.ok(res.filesCreated.length >= 6);

      const agentsAudit = path.join(tmpHome, '.agents', 'skills', 'compat-audit', 'SKILL.md');
      const claudeAudit = path.join(tmpHome, '.claude', 'skills', 'compat-audit', 'SKILL.md');
      const geminiAudit = path.join(tmpHome, '.gemini', 'config', 'skills', 'compat-audit', 'SKILL.md');

      assert.ok(fs.existsSync(agentsAudit), 'Universal ~/.agents/skills should exist');
      assert.ok(fs.existsSync(claudeAudit), 'Claude Code ~/.claude/skills should exist');
      assert.ok(fs.existsSync(geminiAudit), 'Antigravity ~/.gemini/config/skills should exist');
    } finally {
      fs.rmSync(tmpHome, { recursive: true, force: true });
    }
  });
});
