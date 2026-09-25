import { auditBundle } from './index.js';
import { formatTerminalReport } from './formatters/terminal.js';
import { formatJsonReport } from './formatters/json.js';
import { formatMarkdownReport } from './formatters/markdown.js';
import { initSkills, promptScope } from './commands/init.js';
import pc from 'picocolors';

export async function runCli(argv = []) {
  let dir = null;
  let format = 'terminal';
  let failOnIncompatible = false;
  let build = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
    if (arg === '--version' || arg === '-v') {
      console.log('compat-audit v1.2.0');
      process.exit(0);
    }
    if (arg === 'init' || arg === 'init-skills' || arg === '--init-skills') {
      let isGlobal = argv.includes('--global') || argv.includes('-g');
      const isLocalExplicit = argv.includes('--local') || argv.includes('-l');

      if (!isGlobal && !isLocalExplicit) {
        const choice = await promptScope();
        if (choice === 'global') {
          isGlobal = true;
        }
      }

      const res = initSkills({ global: isGlobal });
      console.log('');
      console.log(pc.bold(pc.green(`Successfully scaffolded AI agent skills (${isGlobal ? 'Global' : 'Project'}):`)));
      for (const f of res.filesCreated) {
        console.log(`  - ${pc.cyan(f)}`);
      }
      console.log('');
      console.log(pc.bold('Supported AI agent harnesses:'));
      for (const h of res.harnessesSupported) {
        console.log(`  - ${pc.dim(h)}`);
      }
      console.log('');
      console.log('Your coding agent (Claude Code, Codex, Antigravity, Cursor, Zed, OpenCode) can now:');
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
    } else if (arg === '--build') {
      build = true;
    } else if (arg === '--fail-on-incompatible') {
      failOnIncompatible = true;
    } else if (!arg.startsWith('-') && !dir) {
      dir = arg;
    }
  }

  try {
    const report = await auditBundle({ dir, build });

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
  init, --init-skills   Scaffold AI agent skills (prompts for local vs global)

Arguments:
  dir                   Target directory containing compiled assets (auto-detected if omitted)

Options:
  --build               Auto-build production assets using detected package manager if output is missing
  --local, -l           Install skills to project workspace (.agents/skills/) without prompting
  --global, -g          Install skills globally to ~/.agents/skills/ and ~/.gemini/config/skills/
  --format <type>       Output format: terminal (default), json, markdown
  --json                Shorthand for --format json
  --markdown, --md      Shorthand for --format markdown
  --fail-on-incompatible Exit with code 1 if compatibility issues/quick wins are detected
  -h, --help            Display this help message
  -v, --version         Display version
`);
}
