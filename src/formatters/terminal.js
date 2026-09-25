import pc from 'picocolors';
import { TARGET_BROWSERS } from '../data/compat-db.js';

export function formatTerminalReport(report) {
  const lines = [];

  // Header Banner
  lines.push('');
  lines.push(pc.bold(pc.cyan('╔═══════════════════════════════════════════════════════════════════════════╗')));
  lines.push(pc.bold(pc.cyan('║                       COMPAT-AUDIT BUNDLE REPORT                          ║')));
  lines.push(pc.bold(pc.cyan('╚═══════════════════════════════════════════════════════════════════════════╝')));
  lines.push('');

  lines.push(`${pc.bold('Scanned Directory:')} ${pc.green(report.targetDir)}`);
  lines.push(`${pc.bold('Assets Scanned:')}    ${pc.yellow(report.totalFiles)} files (${report.totalJsFiles} JS, ${report.totalCssFiles} CSS, ${report.totalHtmlFiles} HTML)`);
  lines.push(`${pc.bold('Estimated Coverage:')} ${pc.bold(pc.green(report.coverage + '%'))} global audience`);
  lines.push('');

  // Browser Floor Matrix
  lines.push(pc.bold(pc.underline('EFFECTIVE BROWSER FLOOR (Minimum required versions):')));
  const matrixEntries = TARGET_BROWSERS.map(b => {
    const ver = report.browserFloor[b.key];
    const verStr = ver ? `${b.name} ${pc.bold(pc.magenta(ver + '+'))}` : `${b.name} ${pc.dim('all')}`;
    return verStr;
  });
  lines.push(`   ${matrixEntries.join('  |  ')}`);
  lines.push('');

  // Intent vs Reality
  if (report.diagnostics && report.diagnostics.length > 0) {
    lines.push(pc.bold(pc.yellow('INTENT VS REALITY DIAGNOSTIC:')));
    for (const diag of report.diagnostics) {
      lines.push(`   ${pc.yellow('!')} ${pc.bold(diag.title)}: ${diag.message}`);
    }
    lines.push('');
  }

  // Quick Wins Table
  lines.push(pc.bold(pc.underline('TOP QUICK-WINS & LOW-HANGING FRUITS (Sorted by ROI):')));
  if (report.quickWins.length === 0) {
    lines.push(`   ${pc.green('No low-hanging fruit issues found. Your bundle is already widely compatible!')}`);
  } else {
    lines.push(`   ┌───────┬───────────────────────────────┬─────────────┬─────────────┬────────────────────────────────────────────────────────┐`);
    lines.push(`   │ ${pc.bold('Level')} │ ${pc.bold('Feature')}                       │ ${pc.bold('Category')}    │ ${pc.bold('Est. Time')}   │ ${pc.bold('Recommended Action')}                                       │`);
    lines.push(`   ├───────┼───────────────────────────────┼─────────────┼─────────────┼────────────────────────────────────────────────────────┤`);

    for (const item of report.quickWins.slice(0, 8)) {
      const levelBadge = item.effort === 1 ? pc.bgGreen(pc.black(` E1 `)) : pc.bgYellow(pc.black(` E2 `));
      const feat = (item.name || item.featureKey).padEnd(29).slice(0, 29);
      const cat = (item.category || '').padEnd(11).slice(0, 11);
      const time = (item.effortMeta?.timeEst || '').padEnd(11).slice(0, 11);
      const action = (item.remediation || '').padEnd(54).slice(0, 54);
      lines.push(`   │  ${levelBadge} │ ${feat} │ ${cat} │ ${time} │ ${action} │`);
    }
    lines.push(`   └───────┴───────────────────────────────┴─────────────┴─────────────┴────────────────────────────────────────────────────────┘`);
    lines.push(`   ${pc.dim('Legend: E1 = Trivial runtime micro-polyfill (~5m) | E2 = Bundler/PostCSS transpile config (~15m)')}`);
  }
  lines.push('');

  // High effort / Structural blockers
  if (report.structuralBlockers.length > 0) {
    lines.push(pc.bold(pc.magenta('STRUCTURAL LIMITS (Effort 3 & 4 - Requires Architectural Choice):')));
    for (const item of report.structuralBlockers) {
      lines.push(`   • ${pc.bold(item.name)} (${item.featureKey}) : ${pc.dim(item.remediation)}`);
    }
    lines.push('');
  }

  lines.push(pc.dim('Run with --format json or --format markdown for CI/CD or PR integrations.'));
  lines.push('');

  return lines.join('\n');
}
