import { TARGET_BROWSERS } from '../data/compat-db.js';

export function formatMarkdownReport(report) {
  const lines = [];

  lines.push('## Browser Compatibility Audit Report');
  lines.push('');
  lines.push(`- **Scanned Directory:** \`${report.targetDir}\``);
  lines.push(`- **Total Files Scanned:** ${report.totalFiles} (${report.totalJsFiles} JS, ${report.totalCssFiles} CSS, ${report.totalHtmlFiles} HTML)`);
  lines.push(`- **Estimated Global Coverage:** **${report.coverage}%**`);
  lines.push('');

  lines.push('### Effective Browser Floor');
  lines.push('| Browser | Minimum Version Required |');
  lines.push('|---|---|');
  for (const b of TARGET_BROWSERS) {
    const ver = report.browserFloor[b.key];
    lines.push(`| **${b.name}** | \`${ver ? ver + '+' : 'All'}\` |`);
  }
  lines.push('');

  if (report.diagnostics && report.diagnostics.length > 0) {
    lines.push('### Configuration & Bundle Diagnostics');
    for (const d of report.diagnostics) {
      lines.push(`> [!WARNING] **${d.title}**: ${d.message}`);
    }
    lines.push('');
  }

  lines.push('### Actionable Remediations (Polyfills & Configuration)');
  if (report.quickWins.length === 0) {
    lines.push('No immediate remediation required. Your bundle is already broadly compatible!');
  } else {
    lines.push('| Effort Level | Feature | Category | Est. Time | Recommended Action |');
    lines.push('|---|---|---|---|---|');
    for (const item of report.quickWins) {
      lines.push(`| **E${item.effort}** (${item.effortMeta?.label || ''}) | \`${item.name}\` | ${item.category} | ${item.effortMeta?.timeEst || ''} | ${item.remediation} |`);
    }
  }
  lines.push('');

  if (report.structuralBlockers.length > 0) {
    lines.push('### Architectural Constraints (Effort 3 & 4)');
    for (const item of report.structuralBlockers) {
      lines.push(`- **${item.name}** (\`${item.featureKey}\`): ${item.remediation}`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('*Generated automatically by [compat-audit](https://github.com/ronan/compat-audit)*');

  return lines.join('\n');
}
