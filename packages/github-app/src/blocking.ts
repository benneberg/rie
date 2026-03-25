/**
 * PR Blocking Configuration and Logic
 * 
 * Implements GitHub's branch protection rules via status checks.
 * When blocking is enabled, PRs that fail architecture checks
 * will have their status set to 'failure', preventing merge
 * if the 'archlens/architecture' check is configured as required.
 */

/**
 * Blocking configuration options
 */
export interface BlockingConfig {
  /** Enable PR blocking for policy violations */
  enabled: boolean;
  /** Context name for the status check */
  contextName: string;
  /** Block on critical violations */
  blockOnCritical: boolean;
  /** Block on major violations */
  blockOnMajor: boolean;
  /** Block on minor violations */
  blockOnMinor: boolean;
  /** Block on fitness score drop */
  blockOnFitnessDrop: boolean;
  /** Minimum fitness score delta (negative) to trigger blocking */
  minFitnessDelta: number;
  /** List of branches to exclude from blocking */
  excludedBranches: string[];
}

/**
 * Default blocking configuration
 */
export const DEFAULT_BLOCKING_CONFIG: BlockingConfig = {
  enabled: true,
  contextName: 'archlens/architecture',
  blockOnCritical: true,
  blockOnMajor: true,
  blockOnMinor: false,
  blockOnFitnessDrop: true,
  minFitnessDelta: -10,
  excludedBranches: ['main', 'master', 'develop'],
};

/**
 * Environment variable mapping for blocking config
 */
const BLOCKING_ENV = {
  ENABLE_BLOCKING: 'ARCHLENS_BLOCKING_ENABLED',
  BLOCK_ON_CRITICAL: 'ARCHLENS_BLOCK_CRITICAL',
  BLOCK_ON_MAJOR: 'ARCHLENS_BLOCK_MAJOR',
  BLOCK_ON_MINOR: 'ARCHLENS_BLOCK_MINOR',
  BLOCK_ON_FITNESS_DROP: 'ARCHLENS_BLOCK_FITNESS_DROP',
  MIN_FITNESS_DELTA: 'ARCHLENS_MIN_FITNESS_DELTA',
  EXCLUDED_BRANCHES: 'ARCHLENS_EXCLUDED_BRANCHES',
} as const;

/**
 * Load blocking configuration from environment variables
 */
export function loadBlockingConfig(): BlockingConfig {
  const config: BlockingConfig = { ...DEFAULT_BLOCKING_CONFIG };

  // Parse ENABLE_BLOCKING
  if (process.env[BLOCKING_ENV.ENABLE_BLOCKING] !== undefined) {
    config.enabled = process.env[BLOCKING_ENV.ENABLE_BLOCKING] !== 'false';
  }

  // Parse BLOCK_ON_CRITICAL
  if (process.env[BLOCKING_ENV.BLOCK_ON_CRITICAL] !== undefined) {
    config.blockOnCritical = process.env[BLOCKING_ENV.BLOCK_ON_CRITICAL] !== 'false';
  }

  // Parse BLOCK_ON_MAJOR
  if (process.env[BLOCKING_ENV.BLOCK_ON_MAJOR] !== undefined) {
    config.blockOnMajor = process.env[BLOCKING_ENV.BLOCK_ON_MAJOR] !== 'false';
  }

  // Parse BLOCK_ON_MINOR
  if (process.env[BLOCKING_ENV.BLOCK_ON_MINOR] !== undefined) {
    config.blockOnMinor = process.env[BLOCKING_ENV.BLOCK_ON_MINOR] !== 'false';
  }

  // Parse BLOCK_ON_FITNESS_DROP
  if (process.env[BLOCKING_ENV.BLOCK_ON_FITNESS_DROP] !== undefined) {
    config.blockOnFitnessDrop = process.env[BLOCKING_ENV.BLOCK_ON_FITNESS_DROP] !== 'false';
  }

  // Parse MIN_FITNESS_DELTA
  if (process.env[BLOCKING_ENV.MIN_FITNESS_DELTA] !== undefined) {
    const delta = parseInt(process.env[BLOCKING_ENV.MIN_FITNESS_DELTA], 10);
    if (!isNaN(delta)) {
      config.minFitnessDelta = delta;
    }
  }

  // Parse EXCLUDED_BRANCHES
  if (process.env[BLOCKING_ENV.EXCLUDED_BRANCHES]) {
    config.excludedBranches = process.env[BLOCKING_ENV.EXCLUDED_BRANCHES].split(',').map(b => b.trim());
  }

  return config;
}

/**
 * Violation severity levels
 */
export type ViolationSeverity = 'critical' | 'major' | 'minor' | 'warning' | 'info';

/**
 * Determine if a PR should be blocked based on violations and config
 */
export function shouldBlockPR(
  violations: Array<{ severity: ViolationSeverity; ruleId: string }>,
  fitnessDelta: number,
  targetBranch: string,
  config: BlockingConfig = DEFAULT_BLOCKING_CONFIG
): { shouldBlock: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // Check if branch is excluded
  if (config.excludedBranches.includes(targetBranch)) {
    return { shouldBlock: false, reasons: ['Branch is excluded from blocking'] };
  }

  // Check if blocking is disabled
  if (!config.enabled) {
    return { shouldBlock: false, reasons: ['Blocking is disabled'] };
  }

  // Check critical violations
  const criticalViolations = violations.filter(v => v.severity === 'critical');
  if (config.blockOnCritical && criticalViolations.length > 0) {
    reasons.push(`${criticalViolations.length} critical violation(s)`);
  }

  // Check major violations
  const majorViolations = violations.filter(v => v.severity === 'major');
  if (config.blockOnMajor && majorViolations.length > 0) {
    reasons.push(`${majorViolations.length} major violation(s)`);
  }

  // Check minor violations
  const minorViolations = violations.filter(v => v.severity === 'minor');
  if (config.blockOnMinor && minorViolations.length > 0) {
    reasons.push(`${minorViolations.length} minor violation(s)`);
  }

  // Check fitness score drop
  if (config.blockOnFitnessDrop && fitnessDelta < config.minFitnessDelta) {
    reasons.push(`Fitness score dropped by ${Math.abs(fitnessDelta)} (threshold: ${Math.abs(config.minFitnessDelta)})`);
  }

  return {
    shouldBlock: reasons.length > 0,
    reasons,
  };
}

/**
 * Get the GitHub status state based on blocking decision
 */
export function getBlockingStatus(
  shouldBlock: boolean,
  violations: Array<{ severity: ViolationSeverity }>
): 'failure' | 'success' {
  if (shouldBlock) {
    return 'failure';
  }
  return 'success';
}

/**
 * Generate blocking summary for PR comment
 */
export function generateBlockingSummary(
  shouldBlock: boolean,
  reasons: string[],
  config: BlockingConfig
): string {
  if (!shouldBlock) {
    return '';
  }

  let summary = `### 🚫 Merge Blocked\n\n`;
  summary += `**This PR cannot be merged until the following issues are resolved:**\n\n`;

  for (const reason of reasons) {
    summary += `- ${reason}\n`;
  }

  summary += `\n---\n\n`;
  summary += `**To resolve:**\n`;
  summary += `1. Review the violations listed above\n`;
  summary += `2. Fix the architecture issues or update the architecture graph\n`;
  summary += `3. Push your changes to update the status check\n\n`;
  summary += `*Contact your architecture team if you believe these violations are acceptable.*\n`;

  return summary;
}

/**
 * Generate remediation instructions for violations
 */
export function generateRemediationInstructions(
  violations: Array<{
    severity: ViolationSeverity;
    message: string;
    filePath?: string;
    remediation?: string;
  }>
): string {
  if (violations.length === 0) {
    return '';
  }

  let instructions = `### 🔧 Remediation Guide\n\n`;

  const grouped = violations.reduce((acc, v) => {
    if (!acc[v.severity]) acc[v.severity] = [];
    acc[v.severity].push(v);
    return acc;
  }, {} as Record<ViolationSeverity, typeof violations>);

  const severityOrder: ViolationSeverity[] = ['critical', 'major', 'minor', 'warning', 'info'];

  for (const severity of severityOrder) {
    const items = grouped[severity];
    if (!items || items.length === 0) continue;

    const emoji = {
      critical: '🔴',
      major: '🟠',
      minor: '🟡',
      warning: '⚠️',
      info: 'ℹ️',
    }[severity];

    instructions += `#### ${emoji} ${severity.charAt(0).toUpperCase() + severity.slice(1)} Violations\n\n`;

    for (const violation of items) {
      instructions += `**${violation.message}**\n`;
      if (violation.filePath) {
        instructions += `- Location: \`${violation.filePath}\`\n`;
      }
      if (violation.remediation) {
        instructions += `- Fix: ${violation.remediation}\n`;
      }
      instructions += `\n`;
    }
  }

  return instructions;
}
