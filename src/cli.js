import { auditBundle } from './index.js';
import { formatTerminalReport } from './formatters/terminal.js';
import { formatJsonReport } from './formatters/json.js';
import { formatMarkdownReport } from './formatters/markdown.js';

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
      console.log('compat-audit v1.0.0');
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
compat-audit [dir] [options]

Zero-config browser compatibility auditor & quick-win optimizer for production bundles.

Arguments:
  dir                   Target directory containing compiled assets (auto-detected if omitted)

Options:
  --format <type>       Output format: terminal (default), json, markdown
  --json                Shorthand for --format json
  --markdown, --md      Shorthand for --format markdown
  --fail-on-incompatible Exit with code 1 if compatibility issues/quick wins are detected
  -h, --help            Display this help message
  -v, --version         Display version
`);
}
