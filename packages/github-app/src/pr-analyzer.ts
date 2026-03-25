import type { CanonicalArchitectureGraph, Violation } from '@archlens/core';
import type { PRAnalysisResult } from './github-client.js';
import {
  shouldBlockPR,
  getBlockingStatus,
  generateBlockingSummary,
  generateRemediationInstructions,
  loadBlockingConfig,
  DEFAULT_BLOCKING_CONFIG,
  type BlockingConfig,
  type ViolationSeverity,
} from './blocking.js';

/**
 * PR Analyzer configuration
 */
export interface PRAnalyzerConfig {
  /** Minimum fitness score delta to block */
  minFitnessDelta?: number;
  /** Enable PR blocking for critical violations */
  enableBlocking?: boolean;
  /** Custom blocking rules */
  blockingRules?: BlockingRule[];
  /** Custom blocking configuration (overrides env vars) */
  blockingConfig?: Partial<BlockingConfig>;
}

/**
 * Rule for blocking PRs
 */
export interface BlockingRule {
  id: string;
  name: string;
  severity: 'critical' | 'major' | 'minor' | 'info';
  condition: (violations: Violation[]) => boolean;
}

/**
 * Default blocking rules
 */
const defaultBlockingRules: BlockingRule[] = [
  {
    id: 'critical-violations',
    name: 'Critical Violations Exist',
    severity: 'critical',
    condition: (violations) => violations.some(v => v.severity === 'critical'),
  },
  {
    id: 'fitness-score-drop',
    name: 'Fitness Score Drop',
    severity: 'major',
    condition: (violations, delta) => delta < -10,
  },
  {
    id: 'layer-violations',
    name: 'Layer Violations',
    severity: 'major',
    condition: (violations) => violations.some(v => v.message.includes('Layer violation')),
  },
];

/**
 * PR Analyzer for architecture impact assessment
 */
export class PRAnalyzer {
  private config: Required<PRAnalyzerConfig>;
  private blockingRules: BlockingRule[];
  private blockingConfig: BlockingConfig;

  constructor(config: PRAnalyzerConfig = {}) {
    // Load blocking config from environment
    this.blockingConfig = {
      ...loadBlockingConfig(),
      ...config.blockingConfig,
    };

    this.config = {
      minFitnessDelta: config.minFitnessDelta ?? this.blockingConfig.minFitnessDelta,
      enableBlocking: config.enableBlocking ?? this.blockingConfig.enabled,
      blockingRules: config.blockingRules ?? defaultBlockingRules,
    };
    this.blockingRules = this.config.blockingRules;
  }

  /**
   * Analyze a pull request for architecture impact
   */
  async analyze(
    pr: {
      number: number;
      repo: string;
      headSha: string;
      headBranch: string;
      baseBranch: string;
      changedFiles: string[];
    },
    currentGraph: CanonicalArchitectureGraph,
    previousGraph?: CanonicalArchitectureGraph
  ): Promise<PRAnalysisResult> {
    // Analyze the impact of changed files
    const impact = this.calculateImpact(
      pr.changedFiles,
      currentGraph,
      previousGraph
    );

    // Determine if PR should be blocked using the blocking module
    const { shouldBlock, reasons } = shouldBlockPR(
      impact.newViolations.map(v => ({ severity: v.severity as ViolationSeverity, ruleId: v.ruleId || '' })),
      impact.fitnessScoreDelta,
      pr.baseBranch,
      this.blockingConfig
    );

    // Generate status check details
    const statusCheck = this.generateStatusCheck(impact, shouldBlock, reasons);

    return {
      prNumber: pr.number,
      repo: pr.repo,
      headSha: pr.headSha,
      baseBranch: pr.baseBranch,
      headBranch: pr.headBranch,
      changedFiles: pr.changedFiles,
      impact,
      shouldBlock,
      statusCheck,
    };
  }

  /**
   * Calculate the architecture impact of changes
   */
  private calculateImpact(
    changedFiles: string[],
    currentGraph: CanonicalArchitectureGraph,
    previousGraph?: CanonicalArchitectureGraph
  ): PRAnalysisResult['impact'] {
    // Find violations related to changed files
    const newViolations = currentGraph.violations?.filter(v => 
      changedFiles.some(file => v.filePath.includes(file))
    ) || [];

    // Find violations that were fixed
    const fixedViolations: Violation[] = [];
    if (previousGraph?.violations) {
      const currentViolationIds = new Set(newViolations.map(v => `${v.filePath}:${v.message}`));
      for (const prevV of previousGraph.violations) {
        const violationKey = `${prevV.filePath}:${prevV.message}`;
        if (!currentViolationIds.has(violationKey)) {
          fixedViolations.push(prevV);
        }
      }
    }

    // Calculate fitness score delta
    const currentScore = this.calculateFitnessScore(currentGraph);
    const previousScore = previousGraph 
      ? this.calculateFitnessScore(previousGraph)
      : currentScore;
    const fitnessScoreDelta = currentScore - previousScore;

    // Calculate layer purity delta
    const currentPurity = this.calculateLayerPurity(currentGraph);
    const previousPurity = previousGraph 
      ? this.calculateLayerPurity(previousGraph)
      : currentPurity;
    const layerPurityDelta = currentPurity - previousPurity;

    return {
      newViolations,
      fixedViolations,
      fitnessScoreDelta,
      layerPurityDelta,
    };
  }

  /**
   * Calculate Architecture Fitness Score
   * AFS = (25% * Stability) + (20% * LayerPurity) + (20% * Security) +
   *       (15% * Complexity) + (10% * Testability) + (10% * Documentation)
   */
  private calculateFitnessScore(graph: CanonicalArchitectureGraph): number {
    // Calculate stability based on module stability metrics
    const stabilityScores = graph.modules
      .filter(m => m.metrics?.stability !== undefined)
      .map(m => m.metrics!.stability!);
    const avgStability = stabilityScores.length > 0
      ? stabilityScores.reduce((a, b) => a + b, 0) / stabilityScores.length
      : 1;

    // Calculate layer purity
    const layerPurity = this.calculateLayerPurity(graph);

    // For now, use simple heuristics
    const security = 0.9; // Placeholder
    const complexity = 0.8; // Placeholder
    const testability = 0.85; // Placeholder
    const documentation = 0.75; // Placeholder

    const afs = (
      0.25 * avgStability +
      0.20 * layerPurity +
      0.20 * security +
      0.15 * complexity +
      0.10 * testability +
      0.10 * documentation
    ) * 100;

    return Math.round(afs * 10) / 10;
  }

  /**
   * Calculate layer purity percentage
   */
  private calculateLayerPurity(graph: CanonicalArchitectureGraph): number {
    const forbiddenDependencies: Record<string, string[]> = {
      'ui': ['infrastructure', 'infra'],
      'presentation': ['infrastructure', 'infra'],
    };

    let totalDeps = graph.dependencies.length;
    let violatingDeps = 0;

    for (const dep of graph.dependencies) {
      const sourceModule = graph.modules.find(m => m.id === dep.sourceId);
      const targetModule = graph.modules.find(m => m.id === dep.targetId);

      if (sourceModule && targetModule) {
        const forbiddenTargets = forbiddenDependencies[sourceModule.type];
        if (forbiddenTargets?.includes(targetModule.type)) {
          violatingDeps++;
        }
      }
    }

    return totalDeps > 0
      ? Math.round((1 - violatingDeps / totalDeps) * 100)
      : 100;
  }

  /**
   * Determine if PR should be blocked
   */
  private shouldBlock(violations: Violation[], fitnessDelta: number): boolean {
    if (!this.config.enableBlocking) {
      return false;
    }

    // Check against blocking rules
    for (const rule of this.blockingRules) {
      if (rule.condition(violations, fitnessDelta)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Generate status check details
   */
  private generateStatusCheck(
    impact: PRAnalysisResult['impact'],
    shouldBlock: boolean,
    blockReasons: string[] = []
  ): PRAnalysisResult['statusCheck'] {
    const criticalViolations = impact.newViolations.filter(v => v.severity === 'critical');
    const majorViolations = impact.newViolations.filter(v => v.severity === 'major');

    let status: 'pending' | 'success' | 'failure';
    let conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | undefined;
    let title: string;
    let summary: string;
    let details: string;

    // Use blocking module to determine status
    status = getBlockingStatus(shouldBlock, impact.newViolations.map(v => ({ severity: v.severity as ViolationSeverity }))) as typeof status;
    conclusion = status as typeof conclusion;

    if (shouldBlock) {
      title = 'Architecture Violations Blocked';
      summary = `${criticalViolations.length} critical, ${majorViolations.length} major violations`;
      
      // Generate blocking summary using the blocking module
      details = generateBlockingSummary(shouldBlock, blockReasons, this.blockingConfig);
      
      // Add remediation instructions
      details += '\n\n' + generateRemediationInstructions(impact.newViolations);
    } else if (impact.newViolations.length > 0) {
      title = 'Architecture Warnings';
      summary = `${impact.newViolations.length} violations (non-blocking)`;
      details = `This PR has some architecture violations but no blocking issues.\n\n`;
      
      for (const v of impact.newViolations.slice(0, 5)) {
        details += `- ${v.message}\n`;
      }
      
      if (impact.newViolations.length > 5) {
        details += `\n...and ${impact.newViolations.length - 5} more violations.\n`;
      }
    } else {
      title = 'Architecture Check Passed';
      summary = 'No violations detected';
      details = 'This PR passes all architecture checks.';
    }

    // Add metrics if available
    if (impact.fitnessScoreDelta !== 0) {
      details += `\n\n**Metrics:**\n`;
      details += `- Fitness Score: ${impact.fitnessScoreDelta >= 0 ? '+' : ''}${impact.fitnessScoreDelta.toFixed(1)}\n`;
      details += `- Layer Purity: ${impact.layerPurityDelta >= 0 ? '+' : ''}${impact.layerPurityDelta.toFixed(1)}%\n`;
    }

    // Add blocking configuration info
    if (this.blockingConfig.enabled) {
      details += `\n\n---\n`;
      details += `*Blocking enabled. Configure at: Settings > Branches > Branch protection rules*\n`;
    }

    return {
      id: `arch-check-${Date.now()}`,
      status,
      conclusion,
      title,
      summary,
      details,
    };
  }

  /**
   * Get the current blocking configuration
   */
  getBlockingConfig(): BlockingConfig {
    return { ...this.blockingConfig };
  }

  /**
   * Add a custom blocking rule
   */
  addBlockingRule(rule: BlockingRule): void {
    this.blockingRules.push(rule);
  }
}
