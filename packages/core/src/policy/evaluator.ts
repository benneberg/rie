// packages/core/src/policy/evaluator.ts
import { CEL } from 'cel-js'; // Hypothetical high-perf CEL wrapper

export interface EvaluationResult {
  isAllowed: boolean;
  message?: string;
}

export class PolicyEvaluator {
  private engine = new CEL();

  // This is where we define the "Clean Architecture" logic
  evaluate(edge: CAGEdge, source: CAGNode, target: CAGNode, rule: string): EvaluationResult {
    const context = {
      src: source,
      dst: target,
      edge: edge
    };

    try {
      // The rule is a CEL string like: "src.layer == 'domain' && dst.layer != 'domain'"
      const result = this.engine.evaluate(rule, context);
      
      return {
        isAllowed: !result, // If 'deny if' evaluates to true, it's NOT allowed
        message: result ? `Violation: ${source.layer} cannot depend on ${target.layer}` : undefined
      };
    } catch (err) {
      console.error("Policy Evaluation Error:", err);
      return { isAllowed: true }; // Fail-open for safety in MVP
    }
  }
}
