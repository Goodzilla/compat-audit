import { auditBundle } from './index.js';
import { formatTerminalReport } from './formatters/terminal.js';
import { formatJsonReport } from './formatters/json.js';
import { formatMarkdownReport } from './formatters/markdown.js';
import { initSkills } from './commands/init.js';
import pc from 'picocolors';

export async function runCli(argv = []) {
  let dir = null;
  let format = 'terminal';
  let failOnIncompatible = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
    if (arg === '--version' || arg === '-v') {
      console.log('compat-audit v1.1.0');
      process.exit(0);
    }
    if (arg === 'init' || arg === 'init-skills' || arg === '--init-skills') {
      const isGlobal = argv.includes('--global') || argv.includes('-g');
      const res = initSkills({ global: isGlobal });
      console.log('');
      console.log(pc.bold(pc.green('Successfully scaffolded AI agent skills:')));
      for (const f of res.filesCreated) {
        console.log(`  - ${pc.cyan(f)}`);
      }
      console.log('');
      console.log('Your coding agent (Antigravity, Claude Code, Cursor) can now:');
      console.log(`  1. Automatically audit bundle floors on build (${pc.bold('/compat-audit')})`);
      console.log(`  2. Interactively optimize bundles to reach older browsers (${pc.bold('/compat-optimize')})`);
      console.log('');
      process.exit(0);
    }
    if (arg === '--format' && argv[i + 1]) {
      format = argv[++i];
    } else if (arg === '--json') {
      format = 'json';
    } else if (arg === '--markdown' || arg === '--md') {
      format = 'markdown';
    } else if (arg === '--fail-on-incompatible') {
      failOnIncompatible = true;
    } else if (!arg.startsWith('-') && !dir) {
      dir = arg;
    }
  }

  try {
    const report = await auditBundle({ dir });

    if (format === 'json') {
      console.log(formatJsonReport(report));
    } else if (format === 'markdown') {
      console.log(formatMarkdownReport(report));
    } else {
      console.log(formatTerminalReport(report));
    }

    if (failOnIncompatible && report.quickWins.length > 0) {
      process.exit(1);
    }
  } catch (err) {
    console.error(`\x1b[31mError:\x1b[0m ${err.message}`);
    process.exit(1);
  }
}

function printHelp() {
  console.log(`
compat-audit [command|dir] [options]

AI Agent skills scaffolder & zero-config browser compatibility engine for production bundles.

Commands:
  init, --init-skills   Scaffold AI agent skills into .agents/skills/ (or global with -g)

Arguments:
  dir                   Target directory containing compiled assets (auto-detected if omitted)

Options:
  --global, -g          Install skills globally to ~/.gemini/config/skills/ (with init)
  --format <type>       Output format: terminal (default), json, markdown
  --json                Shorthand for --format json
  --markdown, --md      Shorthand for --format markdown
  --fail-on-incompatible Exit with code 1 if compatibility issues/quick wins are detected
  -h, --help            Display this help message
  -v, --version         Display version
`);
}
