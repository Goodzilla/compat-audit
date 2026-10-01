export function formatMarkdownReport(report) {
  if (report.isMonorepo) {
    return formatMarkdownMonorepoReport(report);
  }
  return formatMarkdownSingleReport(report);
}

export function formatMarkdownSingleReport(report, options = {}) {
  const lines = [];

  const h2Prefix = options.isSubProject ? '###' : '##';
  const h3Prefix = options.isSubProject ? '####' : '###';

  if (!options.isSubProject) {
    lines.push('## Browser Compatibility Audit Report');
    lines.push('');
  }

  // 1. Executive Summary
  const targetLabel = report.declaredTargets?.targetLabel || 'ES2015';
  const targetCov = report.targetCoverage ?? 99.9;
  const measuredCov = report.measuredCoverage ?? report.coverage;
  const regionLabel = report.regionLabel || (report.region === 'global' ? 'Global' : (report.region?.toUpperCase() || 'Global'));

  let gapText = '0% (Aligned with target)';
  if (report.audienceGap < 0) {
    gapText = `**${report.audienceGap}%** (Drift vs target)`;
  } else if (report.audienceGap > 0) {
    gapText = `**+${report.audienceGap}%** (Exceeds target)`;
  } else if (report.audienceLoss > 0) {
    gapText = `**-${report.audienceLoss}%** (Drift vs target)`;
  }

  lines.push(`${h2Prefix} 1. Executive Summary`);
  if (report.hasGaps) {
    const driftAmt = Math.abs(report.audienceGap !== undefined ? report.audienceGap : report.audienceLoss);
    lines.push('> [!WARNING]');
    lines.push('> **Verdict: COMPATIBILITY GAP DETECTED**');
    lines.push(`> Production bundles contain features that exceed declared browser floors, resulting in an estimated **${driftAmt}%** audience drift.`);
  } else {
    lines.push('> [!NOTE]');
    lines.push('> **Verdict: COMPLIANT**');
    lines.push('> Production bundle fully satisfies all declared browser compatibility targets.');
  }
  lines.push('');
  lines.push(`- **Scanned Directory:** \`${report.targetDir}\``);
  lines.push(`- **Total Files Scanned:** ${report.totalFiles} (${report.totalJsFiles} JS, ${report.totalCssFiles} CSS, ${report.totalHtmlFiles} HTML)`);
  if (report.detectedPolyfills && report.detectedPolyfills.length > 0) {
    const hasRuntime = report.detectedPolyfills.some(p => p.runtimeVerified);
    const badge = hasRuntime ? ' *(Runtime Verified)*' : '';
    const polyNames = report.detectedPolyfills.map(p => {
      const chunk = p.originChunk ? ` (\`${p.originChunk.split('/').pop()}\`)` : '';
      return `\`${p.name || p.featureKey}\`${chunk}`;
    }).slice(0, 5).join(', ');
    const count = report.detectedPolyfills.length;
    const more = count > 5 ? ` +${count - 5} more` : '';
    lines.push(`- **Detected Polyfills${badge}:** ${count} active (${polyNames}${more})`);
  }
  lines.push(`- **Target Coverage (${regionLabel}):** **${targetCov}%**${targetLabel ? ` (${targetLabel})` : ''}`);
  lines.push(`- **Measured Coverage (${regionLabel}):** **${measuredCov}%**`);
  lines.push(`- **Audience Gap:** ${gapText}`);
  lines.push('');

  // 2. Browser Compatibility Summary
  lines.push(`${h2Prefix} 2. Browser Compatibility Summary`);
  lines.push('| Platform | Environment | Declared Target | Minimum Supported Version | Status & Headroom |');
  lines.push('|---|---|---|---|---|');

  for (const item of (report.browserSummary || [])) {
    const isMobile = item.platform === 'mobile' || item.key === 'ios_saf' || item.key === 'chrome_android' || item.key === 'samsung';
    const platStr = isMobile ? 'Mobile' : 'Desktop';
    const statusBadge = item.status === 'gap'
      ? `**Gap: -${item.gap} vers**`
      : (item.headroom > 0 ? `+${item.headroom} vers headroom` : 'Aligned');

    lines.push(`| ${platStr} | **${item.browser}** | \`${item.targetDisplay || item.declaredTarget}\` | \`${item.minVersion}+\` | ${statusBadge} |`);
  }
  lines.push('');

  // 3. Diagnostics & Code Findings
  if (report.diagnostics && report.diagnostics.length > 0) {
    lines.push(`${h2Prefix} 3. Diagnostics & Code Findings`);
    for (const d of report.diagnostics) {
      lines.push(`> [!WARNING] **${d.title}**: ${d.message}`);
    }
    lines.push('');
  }

  // 4. Compatibility Issues & Breaking Impacts
  lines.push(`${h2Prefix} 4. Compatibility Issues & Breaking Impacts`);
  const issues = report.issues || [];
  if (issues.length === 0) {
    lines.push('No compatibility issues found. Bundle meets or exceeds all declared targets.');
  } else {
    lines.push('| Severity | Feature | Impact / Error Type | Broken Browsers | Audience Loss |');
    lines.push('|---|---|---|---|---|');
    for (const item of issues) {
      const brokenStr = (item.brokenBrowsers && item.brokenBrowsers.length > 0)
        ? item.brokenBrowsers.join(', ')
        : 'All modern';
      const lossStr = item.audienceLossDisplay || (item.audienceLoss ? `${item.audienceLoss}%` : '0%');
      lines.push(`| **${item.severity}** | \`${item.name}\` | ${item.impactType} | ${brokenStr} | ${lossStr} |`);
    }
    lines.push('');
    lines.push('> [!TIP]');
    lines.push('> Run `/compat-optimize` to interactively resolve these compatibility issues.');
  }
  lines.push('');

  if (!options.isSubProject) {
    lines.push('---');
    lines.push('*Generated automatically by [compat-audit](https://github.com/Goodzilla/compat-audit)*');
  }

  return lines.join('\n');
}

export function formatMarkdownMonorepoReport(report) {
  const lines = [];

  const regionLabel = report.regionLabel || (report.region === 'global' ? 'Global' : (report.region?.toUpperCase() || 'Global'));

  lines.push('# Monorepo Browser Compatibility Audit Report');
  lines.push('');
  lines.push(`- **Workspace Configuration:** \`${report.workspaceConfig}\``);
  lines.push(`- **Projects Audited:** ${report.summary.totalProjects} (${report.summary.compliantProjects} compliant, ${report.summary.gapProjects} with gaps)`);
  lines.push(`- **Global Verdict:** **${report.summary.verdict}**`);
  lines.push('');

  // 1. Monorepo Summary Table
  lines.push('## Monorepo Summary');
  lines.push(`| Project | Path | Declared Target | Measured Floor | Coverage (${regionLabel}) | Status |`);
  lines.push('|---|---|---|---|---|---|');

  for (const proj of report.projects) {
    const r = proj.report;
    const targetLabel = r.declaredTargets?.targetLabel || 'ES2015';
    const minVersions = ['chrome', 'safari', 'firefox']
      .map(k => {
        const v = r.browserFloor?.[k];
        return v ? `${k[0].toUpperCase()}${v}+` : null;
      })
      .filter(Boolean)
      .join(' ') || 'ES2015';
    const cov = (r.measuredCoverage ?? r.coverage) + '%';
    const statusText = r.hasGaps ? '**GAP DETECTED**' : 'Compliant';

    lines.push(`| **${proj.name}** | \`${proj.path}\` | \`${targetLabel}\` | \`${minVersions}\` | **${cov}** | ${statusText} |`);
  }
  lines.push('');

  // 2. Full individual project reports
  for (let i = 0; i < report.projects.length; i++) {
    const proj = report.projects[i];
    lines.push('---');
    lines.push('');
    lines.push(`## Project: ${proj.name} (\`${proj.path}\`)`);
    lines.push('');
    lines.push(formatMarkdownSingleReport(proj.report, { isSubProject: true }));
    lines.push('');
  }

  lines.push('---');
  lines.push('*Generated automatically by [compat-audit](https://github.com/Goodzilla/compat-audit)*');

  return lines.join('\n');
}
