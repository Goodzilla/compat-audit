import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditBundle, normalizeThreshold } from './index.js';
import { formatTerminalReport } from './formatters/terminal.js';
import { formatJsonReport } from './formatters/json.js';
import { formatMarkdownReport } from './formatters/markdown.js';
import { initSkills, promptScope } from './commands/init.js';
import pc from 'picocolors';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8'));

export async function runCli(argv = []) {
  let dir = null;
  let format = 'terminal';
  let failOn = null;
  let ciMode = false;
  let build = false;
  let project = null;
  let region = 'global';
  let all = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
    if (arg === '--version' || arg === '-v') {
      console.log(`compat-audit v${pkg.version}`);
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
    } else if (arg === '--all') {
      all = true;
    } else if ((arg === '--project' || arg === '-p') && argv[i + 1]) {
      project = argv[++i];
    } else if ((arg === '--region' || arg === '-r') && argv[i + 1]) {
      region = argv[++i];
    } else if (arg === '--ci') {
      ciMode = true;
    } else if (arg === '--fail-on' && argv[i + 1] && !argv[i + 1].startsWith('-')) {
      failOn = argv[++i];
    } else if (arg === '--fail-on') {
      console.error(pc.red('Error: --fail-on requires a threshold value (blocking, high, medium, low).'));
      process.exit(1);
    } else if (arg === '--fail-on-incompatible' || arg === '--fail-on-gap') {
      failOn = 'LOW';
    } else if (!arg.startsWith('-') && !dir) {
      dir = arg;
    }
  }

  let threshold = null;
  if (failOn) {
    try {
      threshold = normalizeThreshold(failOn);
    } catch (err) {
      console.error(pc.red(`Error: ${err.message}`));
      process.exit(1);
    }
  } else if (ciMode) {
    threshold = 'BLOCKING';
  }

  try {
    const report = await auditBundle({ dir, build, project, region, all, failOn: threshold });

    if (format === 'json') {
      console.log(formatJsonReport(report));
    } else if (format === 'markdown') {
      console.log(formatMarkdownReport(report));
    } else {
      console.log(formatTerminalReport(report));
    }

    if (threshold) {
      const ci = report.ciResult;
      if (!ci.passed) {
        if (report.isMonorepo) {
          console.error(pc.bold(pc.red(
            `CI check failed: ${ci.failingIssuesCount} issue(s) matching threshold "${ci.threshold}" or above across ${ci.failingProjects.length} project(s) (${ci.failingProjects.join(', ')}).`
          )));
        } else {
          console.error(pc.bold(pc.red(
            `CI check failed: ${ci.failingIssuesCount} issue(s) matching threshold "${ci.threshold}" or above detected.`
          )));
        }
        process.exit(1);
      } else {
        console.log(pc.bold(pc.green(
          `CI check passed: 0 issues matching threshold "${ci.threshold}" or above detected.`
        )));
      }
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
  --project, -p <name>  Audit a specific project in a monorepo workspace
  --region, -r <code>   Audience region for market share coverage (e.g. FR, US, global; default: global)
  --local, -l           Install skills to project workspace (.agents/skills/) without prompting
  --global, -g          Install skills globally to ~/.agents/skills/ and ~/.gemini/config/skills/
  --format <type>       Output format: terminal (default), json, markdown
  --json                Shorthand for --format json
  --markdown, --md      Shorthand for --format markdown
  --all                 List all detected modern features, not just gap-causing issues
  --ci                  Exit with code 1 if BLOCKING issues are detected (default threshold: blocking)
  --fail-on <level>     Set CI failure threshold: blocking, high, medium, low
  --fail-on-gap         Exit with code 1 on any compatibility gap (alias for --fail-on low)
  --fail-on-incompatible Alias for --fail-on-gap
  -h, --help            Display this help message
  -v, --version         Display version
`);
}
