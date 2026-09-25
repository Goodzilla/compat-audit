export function formatMarkdownReport(report) {
  const lines = [];

  lines.push('## Browser Compatibility Audit Report');
  lines.push('');

  // 1. Executive Summary
  lines.push('### 1. Executive Summary');
  if (report.hasGaps) {
    lines.push('> [!WARNING]');
    lines.push('> **Verdict: COMPATIBILITY GAP DETECTED**');
    lines.push(`> Production bundles contain features that exceed declared browser floors, resulting in an estimated **${report.audienceLoss}%** potential audience loss.`);
  } else {
    lines.push('> [!NOTE]');
    lines.push('> **Verdict: COMPLIANT**');
    lines.push('> All scanned bundles meet or exceed declared browser targets with zero compatibility gap.');
  }
  lines.push('');
  lines.push(`- **Scanned Directory:** \`${report.targetDir}\``);
  lines.push(`- **Total Files Scanned:** ${report.totalFiles} (${report.totalJsFiles} JS, ${report.totalCssFiles} CSS, ${report.totalHtmlFiles} HTML)`);
  lines.push(`- **Estimated Global Coverage:** **${report.coverage}%**`);
  lines.push(`- **Compatibility Gap:** **${report.audienceLoss > 0 ? `-${report.audienceLoss}% global audience loss` : '0%'}**`);
  lines.push('');

  // 2. Browser Compatibility Summary
  lines.push('### 2. Browser Compatibility Summary');
  lines.push('| Platform | Environment | Declared Target | Minimum Supported Version | Status & Headroom |');
  lines.push('|---|---|---|---|---|');

  const summary = report.browserSummary || [];
  for (const item of summary) {
    const envLabel = item.browser === 'Chrome' ? 'Chrome / Chromium'
      : item.browser === 'Safari' ? 'Safari / WebKit'
      : item.browser === 'Firefox' ? 'Firefox / Gecko'
      : item.browser;

    const platformLabel = (item.platform === 'mobile' || item.key === 'ios_saf' || item.key === 'chrome_android' || item.key === 'samsung')
      ? 'Mobile'
      : 'Desktop';

    lines.push(`| ${platformLabel} | **${envLabel}** | \`${item.declaredTarget}\` | \`${item.minVersionStr}\` | ${item.statusLabel} |`);
  }
  lines.push('');

  // 3. Diagnostics & Code Findings
  if (report.diagnostics && report.diagnostics.length > 0) {
    lines.push('### 3. Diagnostics & Code Findings');
    for (const d of report.diagnostics) {
      lines.push(`> [!WARNING] **${d.title}**: ${d.message}`);
    }
    lines.push('');
  }

  // 4. Actionable Remediation Plan
  lines.push('### 4. Actionable Remediation Plan');
  if (report.quickWins.length === 0) {
    lines.push('No immediate remediation required. Bundle meets or exceeds all declared targets.');
  } else {
    lines.push('| Effort Level | Feature | Category | Est. Time | Recommended Action |');
    lines.push('|---|---|---|---|---|');
    for (const item of report.quickWins) {
      lines.push(`| **E${item.effort}** (${item.effortMeta?.label || ''}) | \`${item.name}\` | ${item.category} | ${item.effortMeta?.timeEst || ''} | ${item.remediation} |`);
    }
  }
  lines.push('');

  if (report.structuralBlockers && report.structuralBlockers.length > 0) {
    lines.push('#### Architectural Constraints (Effort 3 & 4)');
    for (const item of report.structuralBlockers) {
      lines.push(`- **${item.name}** (\`${item.featureKey}\`): ${item.remediation}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('*Generated automatically by [compat-audit](https://github.com/Goodzilla/compat-audit)*');

  return lines.join('\n');
}
