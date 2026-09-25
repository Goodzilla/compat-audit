import pc from 'picocolors';

export function formatTerminalReport(report) {
  const lines = [];

  // Header Banner
  lines.push('');
  lines.push(pc.bold(pc.cyan('╔═══════════════════════════════════════════════════════════════════════════╗')));
  lines.push(pc.bold(pc.cyan('║                       COMPAT-AUDIT BUNDLE REPORT                          ║')));
  lines.push(pc.bold(pc.cyan('╚═══════════════════════════════════════════════════════════════════════════╝')));
  lines.push('');

  // 1. Executive Summary
  const verdictBadge = report.hasGaps
    ? pc.bgYellow(pc.black(' COMPATIBILITY GAP DETECTED '))
    : pc.bgGreen(pc.black(' COMPLIANT '));

  lines.push(`${pc.bold('Status:')}             ${verdictBadge}`);
  lines.push(`${pc.bold('Scanned Directory:')}  ${pc.green(report.targetDir)}`);
  lines.push(`${pc.bold('Assets Scanned:')}     ${pc.yellow(report.totalFiles)} files (${report.totalJsFiles} JS, ${report.totalCssFiles} CSS, ${report.totalHtmlFiles} HTML)`);
  lines.push(`${pc.bold('Estimated Coverage:')}  ${pc.bold(pc.green(report.coverage + '%'))} global audience`);
  lines.push(`${pc.bold('Compatibility Gap:')}   ${report.audienceLoss > 0 ? pc.bold(pc.red(`-${report.audienceLoss}%`)) : pc.green('0% (Full target alignment)')}`);
  lines.push('');

  // 2. Browser Compatibility Summary
  lines.push(pc.bold(pc.underline('BROWSER COMPATIBILITY SUMMARY:')));
  const summary = report.browserSummary || [];
  for (const item of summary) {
    const statusIcon = item.status === 'gap' ? pc.yellow('⚠') : pc.green('✔');
    const bName = pc.bold(item.browser.padEnd(15));
    const target = pc.dim(`(target: ${item.declaredTarget})`.padEnd(20));
    const minVer = pc.cyan(`min: ${item.minVersion}+`.padEnd(12));
    const note = item.status === 'gap'
      ? pc.yellow(`Gap: -${item.gap} vers`)
      : pc.dim(item.headroom > 0 ? `+${item.headroom} vers headroom` : 'aligned');

    lines.push(`   ${statusIcon} ${bName} ${target} ${minVer} ${note}`);
  }
  lines.push('');

  // 3. Diagnostics & Code Findings
  if (report.diagnostics && report.diagnostics.length > 0) {
    lines.push(pc.bold(pc.yellow('DIAGNOSTICS & CODE FINDINGS:')));
    for (const diag of report.diagnostics) {
      lines.push(`   ${pc.yellow('!')} ${pc.bold(diag.title)}: ${diag.message}`);
    }
    lines.push('');
  }

  // 4. Actionable Remediation Plan
  lines.push(pc.bold(pc.underline('ACTIONABLE REMEDIATIONS (Polyfills & Configuration):')));
  if (report.quickWins.length === 0) {
    lines.push(`   ${pc.green('No immediate remediation required. Bundle meets or exceeds all declared targets.')}`);
  } else {
    lines.push(`   ┌───────┬───────────────────────────────┬─────────────┬─────────────┬────────────────────────────────────────────────────────┐`);
    lines.push(`   │ ${pc.bold('Level')} │ ${pc.bold('Feature')}                       │ ${pc.bold('Category')}    │ ${pc.bold('Est. Time')}   │ ${pc.bold('Recommended Action')}                                     │`);
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
    lines.push(`   ${pc.dim('Legend: E1 = Lightweight runtime polyfill (~5m) | E2 = Bundler/PostCSS transpile config (~15m)')}`);
  }
  lines.push('');

  // Architectural Constraints
  if (report.structuralBlockers && report.structuralBlockers.length > 0) {
    lines.push(pc.bold(pc.magenta('ARCHITECTURAL CONSTRAINTS (Effort 3 & 4 - Requires Architectural Choice):')));
    for (const item of report.structuralBlockers) {
      lines.push(`   • ${pc.bold(item.name)} (${item.featureKey}) : ${pc.dim(item.remediation)}`);
    }
    lines.push('');
  }

  lines.push(pc.dim('Run with --format json or --format markdown for CI/CD or PR integrations.'));
  lines.push('');

  return lines.join('\n');
}
