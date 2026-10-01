import pc from 'picocolors';

export function formatTerminalReport(report) {
  if (report.isMonorepo) {
    return formatTerminalMonorepoReport(report);
  }
  return formatTerminalSingleReport(report);
}

export function formatTerminalSingleReport(report, options = {}) {
  const lines = [];

  // Header Banner
  if (!options.isSubProject) {
    lines.push('');
    lines.push(pc.bold(pc.cyan('╔═══════════════════════════════════════════════════════════════════════════╗')));
    lines.push(pc.bold(pc.cyan('║                       COMPAT-AUDIT BUNDLE REPORT                          ║')));
    lines.push(pc.bold(pc.cyan('╚═══════════════════════════════════════════════════════════════════════════╝')));
    lines.push('');
  }

  // 1. Executive Summary
  const verdictBadge = report.hasGaps
    ? pc.bgYellow(pc.black(' COMPATIBILITY GAP DETECTED '))
    : pc.bgGreen(pc.black(' COMPLIANT '));

  const targetLabel = report.declaredTargets?.targetLabel || 'ES2015';
  const targetCov = report.targetCoverage ?? 99.9;
  const measuredCov = report.measuredCoverage ?? report.coverage;
  const regionLabel = report.regionLabel || (report.region === 'global' ? 'Global' : (report.region?.toUpperCase() || 'Global'));

  let gapDisplay = pc.green('0% (Aligned with target)');
  if (report.audienceGap < 0) {
    gapDisplay = pc.bold(pc.red(`${report.audienceGap}% (Drift vs target)`));
  } else if (report.audienceGap > 0) {
    gapDisplay = pc.bold(pc.green(`+${report.audienceGap}% (Exceeds target)`));
  } else if (report.audienceLoss > 0) {
    gapDisplay = pc.bold(pc.red(`-${report.audienceLoss}% (Drift vs target)`));
  }

  lines.push(`${pc.bold('Status:'.padEnd(28))} ${verdictBadge}`);
  lines.push(`${pc.bold('Scanned Directory:'.padEnd(28))} ${pc.green(report.targetDir)}`);
  lines.push(`${pc.bold('Assets Scanned:'.padEnd(28))} ${pc.yellow(report.totalFiles)} files (${report.totalJsFiles} JS, ${report.totalCssFiles} CSS, ${report.totalHtmlFiles} HTML)`);
  if (report.detectedPolyfills && report.detectedPolyfills.length > 0) {
    const hasRuntime = report.detectedPolyfills.some(p => p.runtimeVerified);
    const label = hasRuntime ? 'Detected Polyfills (Runtime):' : 'Detected Polyfills:';
    const names = report.detectedPolyfills.map(p => {
      const chunk = p.originChunk ? pc.dim(` [${p.originChunk.split('/').pop()}]`) : '';
      return (p.name || p.featureKey) + chunk;
    }).slice(0, 5).join(', ');
    const count = report.detectedPolyfills.length;
    const more = count > 5 ? ` +${count - 5} more` : '';
    lines.push(`${pc.bold(label.padEnd(28))} ${pc.cyan(`${count} active (${names}${more})`)}`);
  }
  lines.push(`${pc.bold(`Target Coverage (${regionLabel}):`.padEnd(28))} ${pc.bold(pc.cyan(targetCov + '%'))}${targetLabel ? ` (${targetLabel})` : ''}`);
  lines.push(`${pc.bold(`Measured Coverage (${regionLabel}):`.padEnd(28))} ${pc.bold(pc.green(measuredCov + '%'))}`);
  lines.push(`${pc.bold('Audience Gap:'.padEnd(28))} ${gapDisplay}`);
  lines.push('');

  // 2. Browser Compatibility Summary
  lines.push(pc.bold(pc.underline('BROWSER COMPATIBILITY SUMMARY:')));
  const summary = report.browserSummary || [];
  const targetStrings = summary.map(item => {
    if (item.targetDisplay) return item.targetDisplay;
    const hasSpecificVer = item.targetVersion !== null && item.targetVersion !== undefined
      && !String(item.declaredTarget).includes(String(item.targetVersion));
    return hasSpecificVer
      ? `${item.declaredTarget} ~ v${item.targetVersion}+`
      : item.declaredTarget;
  });
  const maxTargetLen = targetStrings.length > 0
    ? Math.max(20, ...targetStrings.map(s => `(target: ${s})`.length))
    : 20;

  for (let i = 0; i < summary.length; i++) {
    const item = summary[i];
    const targetLabel = targetStrings[i];
    const statusIcon = item.status === 'gap' ? pc.yellow('!') : pc.green('+');
    const isMobile = item.platform === 'mobile' || item.key === 'ios_saf' || item.key === 'chrome_android' || item.key === 'samsung';
    const platformBadge = isMobile ? pc.magenta('[Mobile] ') : pc.blue('[Desk]   ');
    const bName = pc.bold(item.browser.padEnd(16));
    const target = pc.dim(`(target: ${targetLabel})`.padEnd(maxTargetLen + 2));
    const minVer = pc.cyan(`min: ${item.minVersion}+`.padEnd(12));
    const note = item.status === 'gap'
      ? pc.yellow(`Gap: -${item.gap} vers`)
      : pc.dim(item.headroom > 0 ? `+${item.headroom} vers headroom` : 'aligned');

    lines.push(`   ${statusIcon} ${platformBadge}${bName} ${target} ${minVer} ${note}`);
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

  // 4. Compatibility Issues & Breaking Impacts
  lines.push(pc.bold(pc.underline('COMPATIBILITY ISSUES & BREAKING IMPACTS:')));
  const issues = report.issues || [];
  if (issues.length === 0) {
    lines.push(`   ${pc.green('No compatibility issues found. Bundle meets or exceeds all declared targets.')}`);
  } else {
    const c1 = 12; // Severity
    const c2 = 26; // Feature
    const c3 = 36; // Impact / Error Type
    const c4 = 28; // Broken Browsers
    const c5 = 16; // Audience Loss

    const top = '   ┌' + '─'.repeat(c1) + '┬' + '─'.repeat(c2) + '┬' + '─'.repeat(c3) + '┬' + '─'.repeat(c4) + '┬' + '─'.repeat(c5) + '┐';
    const mid = '   ├' + '─'.repeat(c1) + '┼' + '─'.repeat(c2) + '┼' + '─'.repeat(c3) + '┼' + '─'.repeat(c4) + '┼' + '─'.repeat(c5) + '┤';
    const bot = '   └' + '─'.repeat(c1) + '┴' + '─'.repeat(c2) + '┴' + '─'.repeat(c3) + '┴' + '─'.repeat(c4) + '┴' + '─'.repeat(c5) + '┘';

    const h1 = ' ' + pc.bold('Severity'.padEnd(c1 - 2)) + ' ';
    const h2 = ' ' + pc.bold('Feature'.padEnd(c2 - 2)) + ' ';
    const h3 = ' ' + pc.bold('Impact / Error Type'.padEnd(c3 - 2)) + ' ';
    const h4 = ' ' + pc.bold('Broken Browsers'.padEnd(c4 - 2)) + ' ';
    const h5 = ' ' + pc.bold('Audience Loss'.padEnd(c5 - 2)) + ' ';

    lines.push(top);
    lines.push(`   │${h1}│${h2}│${h3}│${h4}│${h5}│`);
    lines.push(mid);

    for (const item of issues.slice(0, 10)) {
      let badge = item.severity;
      if (item.severity === 'BLOCKING') {
        badge = pc.bgRed(pc.white(pc.bold(' BLOCKING ')));
      } else if (item.severity === 'HIGH') {
        badge = pc.bgYellow(pc.black(pc.bold('   HIGH   ')));
      } else if (item.severity === 'MEDIUM') {
        badge = pc.bgCyan(pc.black('  MEDIUM  '));
      } else {
        badge = pc.bgWhite(pc.black('   LOW    '));
      }

      const f1 = ' ' + badge + ' ';
      const f2 = ' ' + (item.name || item.featureKey).padEnd(c2 - 2).slice(0, c2 - 2) + ' ';
      const f3 = ' ' + (item.impactType || '').padEnd(c3 - 2).slice(0, c3 - 2) + ' ';
      const brokenStr = (item.brokenBrowsers && item.brokenBrowsers.length > 0)
        ? item.brokenBrowsers.join(', ')
        : 'All modern';
      const f4 = ' ' + brokenStr.padEnd(c4 - 2).slice(0, c4 - 2) + ' ';
      const lossStr = item.audienceLossDisplay || (item.audienceLoss ? `${item.audienceLoss}%` : '0%');
      const f5 = ' ' + lossStr.padEnd(c5 - 2).slice(0, c5 - 2) + ' ';

      lines.push(`   │${f1}│${f2}│${f3}│${f4}│${f5}│`);
    }
    lines.push(bot);
    lines.push(`   ${pc.dim('Legend: BLOCKING = Script crash/SyntaxError | HIGH = ReferenceError | MEDIUM = Broken CSS | LOW = Visual quirk')}`);
    lines.push(`   ${pc.cyan('Run `/compat-optimize` to interactively resolve these compatibility issues.')}`);
  }
  lines.push('');

  if (!options.isSubProject) {
    lines.push(pc.dim('Run with --format json or --format markdown for CI/CD or PR integrations.'));
    lines.push('');
  }

  return lines.join('\n');
}

export function formatTerminalMonorepoReport(report) {
  const lines = [];

  // Top Monorepo Banner
  lines.push('');
  lines.push(pc.bold(pc.cyan('╔═══════════════════════════════════════════════════════════════════════════╗')));
  lines.push(pc.bold(pc.cyan('║                      COMPAT-AUDIT MONOREPO SUMMARY                        ║')));
  lines.push(pc.bold(pc.cyan('╚═══════════════════════════════════════════════════════════════════════════╝')));
  lines.push('');

  const hasGaps = report.summary?.hasGaps;
  const verdictBadge = hasGaps
    ? pc.bgYellow(pc.black(' COMPATIBILITY GAPS DETECTED '))
    : pc.bgGreen(pc.black(' ALL PROJECTS COMPLIANT '));

  const regionLabel = report.regionLabel || (report.region === 'global' ? 'Global' : (report.region?.toUpperCase() || 'Global'));

  lines.push(`${pc.bold('Workspace Config:'.padEnd(28))} ${pc.green(report.workspaceConfig)}`);
  lines.push(`${pc.bold('Projects Audited:'.padEnd(28))} ${pc.yellow(report.summary.totalProjects)} projects (${pc.green(report.summary.compliantProjects + ' compliant')}, ${report.summary.gapProjects > 0 ? pc.yellow(report.summary.gapProjects + ' with gaps') : '0 with gaps'})`);
  lines.push(`${pc.bold('Global Status:'.padEnd(28))} ${verdictBadge}`);
  lines.push('');

  // Monorepo Projects Recap Table
  lines.push(pc.bold(pc.underline('MONOREPO PROJECTS RECAP:')));
  const covHeader = `Coverage (${regionLabel})`.padEnd(16);
  lines.push('  ' + pc.bold('Project'.padEnd(26)) + pc.bold('Declared Target'.padEnd(20)) + pc.bold('Measured Floor'.padEnd(22)) + pc.bold(covHeader) + pc.bold('Status'));
  lines.push('  ' + '─'.repeat(96));

  for (const proj of report.projects) {
    const r = proj.report;
    const nameDisplay = (proj.name || proj.path).slice(0, 24).padEnd(26);
    const targetLabel = (r.declaredTargets?.targetLabel || 'ES2015').slice(0, 18).padEnd(20);

    const minVersions = ['chrome', 'safari', 'firefox']
      .map(k => {
        const v = r.browserFloor?.[k];
        return v ? `${k[0].toUpperCase()}${v}+` : null;
      })
      .filter(Boolean)
      .join(' ') || 'ES2015';
    const floorDisplay = minVersions.slice(0, 20).padEnd(22);
    const cov = r.measuredCoverage ?? r.coverage;
    const covDisplay = pc.bold(`${cov}%`).padEnd(16);

    const statusBadge = r.hasGaps
      ? pc.yellow('GAP DETECTED')
      : pc.green('COMPLIANT');

    lines.push(`  ${pc.bold(nameDisplay)}${targetLabel}${floorDisplay}${covDisplay}${statusBadge}`);
  }
  lines.push('');

  // Complete Report per Project
  for (let i = 0; i < report.projects.length; i++) {
    const proj = report.projects[i];
    const r = proj.report;
    const projTitle = ` PROJECT [${i + 1}/${report.projects.length}]: ${proj.name || proj.path} (${r.targetDir}) `;
    const bar = '═'.repeat(Math.max(75, projTitle.length + 4));

    lines.push('');
    lines.push(pc.bold(pc.cyan('╔' + bar + '╗')));
    lines.push(pc.bold(pc.cyan('║ ') + pc.white(projTitle.padEnd(bar.length - 1)) + pc.cyan('║')));
    lines.push(pc.bold(pc.cyan('╚' + bar + '╝')));
    lines.push('');

    const projectReportText = formatTerminalSingleReport(r, { isSubProject: true });
    lines.push(projectReportText);
  }

  lines.push(pc.dim('Run with --format json or --format markdown for CI/CD or PR integrations.'));
  lines.push('');

  return lines.join('\n');
}
