// packages/core/src/metrics/stability.ts

export function calculateStability(moduleId: string, edges: CAGEdge[]): number {
  // Ca: Count edges where this module is the TARGET
  const afferent = edges.filter(e => e.target === moduleId).length;
  
  // Ce: Count edges where this module is the SOURCE
  const efferent = edges.filter(e => e.source === moduleId).length;

  if (afferent + efferent === 0) return 1.0; // Isolated modules are "stable" by default

  const instability = efferent / (afferent + efferent);
  
  // We return Stability (1 - I)
  return parseFloat((1 - instability).toFixed(2));
}
