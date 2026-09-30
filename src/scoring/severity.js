/**
 * 4-Level Deterministic Compatibility Severity Scoring (CI / Sec standard)
 */
export const SEVERITY_LEVELS = {
  BLOCKING: {
    key: 'BLOCKING',
    label: 'Blocking',
    badge: 'BLOCKING',
    rank: 4,
    description: 'Syntax error or uncaught prototype method call causing immediate script crash'
  },
  HIGH: {
    key: 'HIGH',
    label: 'High',
    badge: 'HIGH',
    rank: 3,
    description: 'Missing global Web API causing runtime ReferenceError when invoked'
  },
  MEDIUM: {
    key: 'MEDIUM',
    label: 'Medium',
    badge: 'MEDIUM',
    rank: 2,
    description: 'Modern CSS selector, at-rule or layout property ignored by browser renderer'
  },
  LOW: {
    key: 'LOW',
    label: 'Low',
    badge: 'LOW',
    rank: 1,
    description: 'Missing vendor prefix (-webkit-) or minor viewport styling quirk'
  }
};

/**
 * Determine severity level and impact classification for a feature finding
 */
export function evaluateSeverity(finding, declaredTargets = null, compatDb = null) {
  const { featureKey = '', name = '', category = '', support = {} } = finding;

  let severity = SEVERITY_LEVELS.MEDIUM;
  let impactType = 'Unsupported Feature';

  // 1. LOW: Vendor prefixes and minor Safari/WebKit visual quirks
  if (featureKey.startsWith('safari.css.') || name.includes('-webkit-')) {
    severity = SEVERITY_LEVELS.LOW;
    impactType = 'Visual Glitch (Prefix missing)';
  }
  // 2. BLOCKING: JS Syntax errors (Script fails at parse time, halting entire bundle)
  else if (
    category === 'syntax' ||
    featureKey.startsWith('javascript.operators.') ||
    featureKey.startsWith('javascript.classes.')
  ) {
    severity = SEVERITY_LEVELS.BLOCKING;
    impactType = 'SyntaxError (Script parse error)';
  }
  // 3. BLOCKING: JS Builtin Prototype methods (TypeError: undefined is not a function)
  else if (
    category === 'prototype' ||
    featureKey.startsWith('javascript.builtins.')
  ) {
    severity = SEVERITY_LEVELS.BLOCKING;
    impactType = 'TypeError (Undefined method)';
  }
  // 4. HIGH: Missing global Web API (ReferenceError: [API] is not defined)
  else if (
    category === 'api' ||
    featureKey.startsWith('api.')
  ) {
    severity = SEVERITY_LEVELS.HIGH;
    impactType = 'ReferenceError (Missing API)';
  }
  // 5. MEDIUM: CSS selectors, at-rules, modern colors / layout properties
  else if (category === 'css') {
    severity = SEVERITY_LEVELS.MEDIUM;
    impactType = 'Ignored CSS (Layout degradation)';
  }
  // 6. LOW: HTML modern attributes/elements (gracefully ignored by browsers)
  else if (category === 'html') {
    severity = SEVERITY_LEVELS.LOW;
    impactType = 'Ignored HTML Attribute/Element';
  }

  // Calculate broken browsers list against declared targets
  const brokenBrowsers = [];
  if (declaredTargets && declaredTargets.browsers && support) {
    for (const [key, browserInfo] of Object.entries(declaredTargets.browsers)) {
      const declaredVer = browserInfo.targetVersion;
      const featVer = support[key];
      if (declaredVer !== null && declaredVer !== undefined && featVer !== null && featVer !== undefined && featVer > declaredVer) {
        brokenBrowsers.push(`${browserInfo.name || key} < ${featVer}`);
      }
    }
  }

  // Calculate audience loss for this specific feature if compatDb & declaredTargets available
  let audienceLoss = 0;
  let audienceLossDisplay = '0%';
  if (compatDb && declaredTargets && declaredTargets.browsers && support) {
    const targetFloors = {};
    const featureWithTargetFloors = {};
    for (const [key, browserInfo] of Object.entries(declaredTargets.browsers)) {
      const declaredVer = browserInfo.targetVersion || 1;
      targetFloors[key] = declaredVer;
      const featVer = support[key];
      featureWithTargetFloors[key] = (featVer && featVer > declaredVer) ? featVer : declaredVer;
    }
    const targetCoverage = compatDb.calculateCoverage(targetFloors);
    const featureCoverage = compatDb.calculateCoverage(featureWithTargetFloors);
    audienceLoss = Math.max(0, Math.round((targetCoverage - featureCoverage) * 10) / 10);
    if (audienceLoss > 0) {
      audienceLossDisplay = `${audienceLoss}%`;
    } else if (brokenBrowsers.length > 0) {
      audienceLossDisplay = '< 0.1%';
    } else {
      audienceLossDisplay = '0%';
    }
  }

  return {
    featureKey,
    name,
    category,
    severity: severity.key,
    severityMeta: severity,
    impactType,
    brokenBrowsers,
    audienceLoss,
    audienceLossDisplay,
    files: finding.files || (finding.file ? [finding.file] : [])
  };
}
