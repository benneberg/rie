// packages/cli/src/commands/analyze.ts
export async function runAnalysis(cag: ArchitectureSnapshot, policies: string[]) {
  const evaluator = new PolicyEvaluator();
  const violations = [];

  for (const edge of cag.edges) {
    const srcNode = cag.nodes.find(n => n.id === edge.source);
    const dstNode = cag.nodes.find(n => n.id === edge.target);

    if (srcNode && dstNode) {
      for (const rule of policies) {
        const result = evaluator.evaluate(edge, srcNode, dstNode, rule);
        if (!result.isAllowed) {
          violations.push({
            file: srcNode.filePath,
            line: edge.line,
            message: result.message
          });
        }
      }
    }
  }

  return violations;
}
