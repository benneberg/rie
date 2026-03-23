// packages/core/src/engine/drift.ts

export interface DriftReport {
  addedNodes: string[];
  removedNodes: string[];
  regressions: Array<{ moduleId: string; metric: string; delta: number }>;
  newViolations: number;
}

export function calculateDrift(base: ArchitectureSnapshot, head: ArchitectureSnapshot): DriftReport {
  const report: DriftReport = {
    addedNodes: [],
    removedNodes: [],
    regressions: [],
    newViolations: head.violations.length - base.violations.length
  };

  // 1. Check for Module Drift
  const baseIds = new Set(base.nodes.map(n => n.id));
  const headIds = new Set(head.nodes.map(n => n.id));

  report.addedNodes = [...headIds].filter(id => !baseIds.has(id));
  report.removedNodes = [...baseIds].filter(id => !headIds.has(id));

  // 2. Check for Metric Regressions (e.g., Stability drops)
  head.nodes.forEach(headNode => {
    const baseNode = base.nodes.find(n => n.id === headNode.id);
    if (baseNode) {
      const stabilityDelta = headNode.stability - baseNode.stability;
      if (stabilityDelta < -0.05) { // Threshold for "significant" drift
        report.regressions.push({
          moduleId: headNode.id,
          metric: 'stability',
          delta: parseFloat(stabilityDelta.toFixed(2))
        });
      }
    }
  });

  return report;
}
