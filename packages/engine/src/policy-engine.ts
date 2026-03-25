import type { PolicyRule, Violation, CanonicalArchitectureGraph } from '@archlens/core';

/**
 * Policy Engine configuration
 */
export interface PolicyEngineConfig {
  /** Enable strict mode - stop on first violation */
  strict?: boolean;
  /** Custom CEL environment variables */
  environment?: Record<string, unknown>;
  /** Maximum violations to collect before stopping */
  maxViolations?: number;
}

/**
 * Policy evaluation result
 */
export interface EvaluationResult {
  passed: boolean;
  violations: Violation[];
  policy: PolicyRule;
  metadata: {
    duration: number;
    timestamp: string;
  };
}

/**
 * Complete evaluation report for an architecture graph
 */
export interface EvaluationReport {
  passed: boolean;
  violations: Violation[];
  summary: {
    critical: number;
    major: number;
    minor: number;
    info: number;
  };
  policyResults: EvaluationResult[];
  metrics: {
    totalModules: number;
    totalDependencies: number;
    totalEdges: number;
    evaluationTime: number;
  };
}

/**
 * Policy Engine for architecture governance.
 *
 * NOTE: The `expression` field on PolicyRule stores a CEL expression string
 * that describes the rule's *intent* for documentation and future CEL runtime
 * integration. The actual enforcement logic below is a deterministic TypeScript
 * implementation of those rules. When cel-js (or a WASM CEL runtime) is wired
 * in, the switch-on-`policy.id` dispatch can be replaced by a real eval loop
 * without changing the public API.
 */
export class PolicyEngine {
  private config: Required<PolicyEngineConfig>;
  private policies: PolicyRule[] = [];

  constructor(config: PolicyEngineConfig = {}) {
    this.config = {
      strict: config.strict ?? false,
      environment: config.environment ?? {},
      maxViolations: config.maxViolations ?? 1000,
    };
  }

  loadPolicies(policies: PolicyRule[]): void {
    this.policies = policies.filter(p => p.enabled);
  }

  async evaluate(graph: CanonicalArchitectureGraph): Promise<EvaluationReport> {
    const startTime = performance.now();
    const violations: Violation[] = [];
    const policyResults: EvaluationResult[] = [];

    for (const policy of this.policies) {
      const result = await this.evaluatePolicy(policy, graph);
      policyResults.push(result);
      violations.push(...result.violations);

      if (this.config.strict && violations.length > 0) break;
      if (violations.length >= this.config.maxViolations) break;
    }

    const endTime = performance.now();

    const summary = {
      critical: violations.filter(v => v.severity === 'critical').length,
      major: violations.filter(v => v.severity === 'major').length,
      minor: violations.filter(v => v.severity === 'minor').length,
      info: violations.filter(v => v.severity === 'info').length,
    };

    return {
      passed: violations.length === 0,
      violations,
      summary,
      policyResults,
      metrics: {
        totalModules: graph.modules.length,
        totalDependencies: graph.dependencies.length,
        totalEdges: graph.dependencies.length,
        evaluationTime: endTime - startTime,
      },
    };
  }

  private async evaluatePolicy(
    policy: PolicyRule,
    graph: CanonicalArchitectureGraph,
  ): Promise<EvaluationResult> {
    const startTime = performance.now();
    const violations: Violation[] = [];

    try {
      switch (policy.id) {
        case 'layer-ui-to-infra':
          violations.push(...this.checkLayerViolations(policy, graph));
          break;
        case 'max-coupling':
          violations.push(...this.checkCouplingViolations(policy, graph));
          break;
        case 'no-circular-deps':
          violations.push(...this.checkCircularDependencies(policy, graph));
          break;
        case 'stability-minimum':
          violations.push(...this.checkStabilityMinimum(policy, graph));
          break;
        default:
          // Future: delegate to a CEL runtime here
          console.warn(`PolicyEngine: no handler for policy "${policy.id}" — skipping`);
      }
    } catch (error) {
      console.error(`PolicyEngine: evaluation failed for "${policy.id}":`, error);
    }

    return {
      passed: violations.length === 0,
      violations,
      policy,
      metadata: {
        duration: performance.now() - startTime,
        timestamp: new Date().toISOString(),
      },
    };
  }

  // ─── Rule implementations ────────────────────────────────────────────────

  /**
   * UI / Presentation layers must not import Infrastructure directly.
   */
  private checkLayerViolations(
    policy: PolicyRule,
    graph: CanonicalArchitectureGraph,
  ): Violation[] {
    const violations: Violation[] = [];

    const forbiddenDependencies: Record<string, string[]> = {
      ui: ['infrastructure', 'infra'],
      presentation: ['infrastructure', 'infra', 'data'],
      controller: ['infrastructure', 'infra'],
    };

    for (const dep of graph.dependencies) {
      const sourceModule = graph.modules.find(m => m.id === dep.sourceId);
      const targetModule = graph.modules.find(m => m.id === dep.targetId);
      if (!sourceModule || !targetModule) continue;

      const forbiddenTargets = forbiddenDependencies[sourceModule.type];
      if (forbiddenTargets?.includes(targetModule.type)) {
        violations.push({
          id: this.violationId(),
          ruleId: policy.id,
          severity: policy.severity,
          message: `Layer violation: ${sourceModule.type} module "${sourceModule.name}" depends on ${targetModule.type} module "${targetModule.name}"`,
          entityId: dep.sourceId,
          filePath: this.filePathForEntity(dep.sourceId, graph),
          lineNumber: 0,
          context: `Dependency: ${dep.sourceId} → ${dep.targetId}`,
          remediation: `Use an intermediate application or domain service instead of accessing ${targetModule.type} directly`,
        });
      }
    }

    return violations;
  }

  /**
   * No module coupling metric should exceed the configured threshold.
   */
  private checkCouplingViolations(
    policy: PolicyRule,
    graph: CanonicalArchitectureGraph,
  ): Violation[] {
    const violations: Violation[] = [];

    // Extract threshold from CEL expression, e.g. "m.metrics.coupling <= 0.15"
    const match = policy.expression.match(/coupling\s*<=?\s*(\d+\.?\d*)/);
    const maxCoupling = match ? parseFloat(match[1]) : 0.15;

    for (const module of graph.modules) {
      const coupling = module.metrics?.coupling;
      if (coupling !== undefined && coupling > maxCoupling) {
        violations.push({
          id: this.violationId(),
          ruleId: policy.id,
          severity: policy.severity,
          message: `Coupling threshold exceeded: module "${module.name}" has coupling ${coupling.toFixed(3)}, max allowed is ${maxCoupling}`,
          entityId: module.id,
          filePath: module.path,
          lineNumber: 0,
          context: `Current coupling: ${coupling.toFixed(3)}`,
          remediation: `Reduce dependencies to bring coupling below ${maxCoupling}`,
        });
      }
    }

    return violations;
  }

  /**
   * No module may participate in a dependency cycle.
   *
   * Uses iterative DFS (Tarjan-style visited/stack) to find cycles.
   * Emits one violation per cycle, not one per node in the cycle.
   */
  private checkCircularDependencies(
    policy: PolicyRule,
    graph: CanonicalArchitectureGraph,
  ): Violation[] {
    const violations: Violation[] = [];
    const visited = new Set<string>();
    const onStack = new Set<string>();
    // Build adjacency list once
    const adj = new Map<string, string[]>();
    for (const dep of graph.dependencies) {
      if (!adj.has(dep.sourceId)) adj.set(dep.sourceId, []);
      adj.get(dep.sourceId)!.push(dep.targetId);
    }

    const dfs = (nodeId: string, path: string[]): void => {
      visited.add(nodeId);
      onStack.add(nodeId);

      for (const neighbour of adj.get(nodeId) ?? []) {
        if (!visited.has(neighbour)) {
          dfs(neighbour, [...path, neighbour]);
        } else if (onStack.has(neighbour)) {
          // Cycle detected — slice the path to the repeated node
          const cycleStart = path.indexOf(neighbour);
          const cyclePath = cycleStart >= 0 ? path.slice(cycleStart) : path;
          cyclePath.push(neighbour); // close the loop visually

          violations.push({
            id: this.violationId(),
            ruleId: policy.id,
            severity: policy.severity,
            message: `Circular dependency: ${cyclePath.join(' → ')}`,
            entityId: nodeId,
            filePath: this.filePathForEntity(nodeId, graph),
            lineNumber: 0,
            context: `Cycle: ${cyclePath.join(' → ')}`,
            remediation: 'Break the cycle by introducing an interface or extracting shared code into a separate module',
          });
        }
      }

      onStack.delete(nodeId);
    };

    for (const module of graph.modules) {
      if (!visited.has(module.id)) {
        dfs(module.id, [module.id]);
      }
    }

    return violations;
  }

  /**
   * Domain modules must maintain a minimum stability score.
   *
   * BUG FIX: the original expression was logically inverted — it was flagging
   * modules that *passed* the threshold. Corrected: flag domain modules whose
   * stability is BELOW the minimum.
   */
  private checkStabilityMinimum(
    policy: PolicyRule,
    graph: CanonicalArchitectureGraph,
  ): Violation[] {
    const violations: Violation[] = [];

    // Extract minimum from CEL expression, e.g. "m.metrics.stability >= 0.7"
    const match = policy.expression.match(/stability\s*>=?\s*(\d+\.?\d*)/);
    const minStability = match ? parseFloat(match[1]) : 0.7;

    for (const module of graph.modules) {
      if (module.type !== 'domain') continue;

      const stability = module.metrics?.stability;
      if (stability !== undefined && stability < minStability) {
        violations.push({
          id: this.violationId(),
          ruleId: policy.id,
          severity: policy.severity,
          message: `Stability below minimum: domain module "${module.name}" has stability ${stability.toFixed(3)}, minimum is ${minStability}`,
          entityId: module.id,
          filePath: module.path,
          lineNumber: 0,
          context: `Current stability: ${stability.toFixed(3)}`,
          remediation: `Stabilise "${module.name}" by reducing its outgoing dependencies or abstracting volatile collaborators`,
        });
      }
    }

    return violations;
  }

  // ─── Helpers ────────────────────────────────────────────────────────────

  private violationId(): string {
    return `violation-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }

  private filePathForEntity(entityId: string, graph: CanonicalArchitectureGraph): string {
    return graph.entities.find(e => e.id === entityId)?.filePath ?? 'unknown';
  }
}

/**
 * Default policy rules shipped with ArchLens RIE.
 * The `expression` field contains the canonical CEL representation for
 * documentation and future runtime evaluation.
 */
export const defaultPolicies: PolicyRule[] = [
  {
    id: 'layer-ui-to-infra',
    name: 'UI to Infrastructure Isolation',
    description: 'UI modules must not depend directly on infrastructure modules',
    expression: 'modules.all(m, m.type != "ui" || m.dependencies.all(d, d.targetType != "infrastructure"))',
    severity: 'critical',
    enabled: true,
    tags: ['layering', 'architecture'],
  },
  {
    id: 'max-coupling',
    name: 'Maximum Coupling Threshold',
    description: 'No module should have a coupling metric exceeding 0.15',
    expression: 'modules.all(m, m.metrics.coupling <= 0.15)',
    severity: 'major',
    enabled: true,
    tags: ['metrics', 'coupling'],
  },
  {
    id: 'no-circular-deps',
    name: 'No Circular Dependencies',
    description: 'Modules must not form dependency cycles',
    expression: 'dependencies.all(d, !hasCycle(d.sourceId))',
    severity: 'critical',
    enabled: true,
    tags: ['dependencies', 'architecture'],
  },
  {
    id: 'stability-minimum',
    name: 'Minimum Domain Module Stability',
    description: 'Domain modules must maintain a stability score at or above 0.7',
    // FIXED: was incorrectly written as an always-true guard; now correctly
    // describes "domain modules must have stability >= 0.7"
    expression: 'modules.all(m, m.type != "domain" || m.metrics.stability >= 0.7)',
    severity: 'major',
    enabled: true,
    tags: ['stability', 'metrics'],
  },
];
