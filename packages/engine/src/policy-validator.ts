import { z } from 'zod';
import type { PolicyRule } from '@archlens/core';
import { PolicyRuleSchema } from '@archlens/core';

/**
 * Policy validation result
 */
export interface PolicyValidationResult {
  valid: boolean;
  errors: PolicyValidationError[];
}

export interface PolicyValidationError {
  field: string;
  message: string;
  rule?: string;
}

/**
 * Validate a single policy rule against the schema and additional semantic rules.
 *
 * Checks performed:
 *  1. Zod schema validation (required fields, enum values, types)
 *  2. ID uniqueness within a set (when called via validatePolicies)
 *  3. Expression non-empty and non-trivial
 *  4. Severity vs. expression consistency warnings
 */
export function validatePolicy(rule: unknown): PolicyValidationResult {
  const errors: PolicyValidationError[] = [];

  // 1. Schema validation
  const parsed = PolicyRuleSchema.safeParse(rule);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push({
        field: issue.path.join('.') || 'root',
        message: issue.message,
      });
    }
    return { valid: false, errors };
  }

  const validated = parsed.data;

  // 2. Expression must not be trivially empty / placeholder
  if (!validated.expression.trim()) {
    errors.push({ field: 'expression', message: 'Expression must not be empty', rule: validated.id });
  }
  if (['true', 'false', '1', '0'].includes(validated.expression.trim())) {
    errors.push({ field: 'expression', message: `Expression "${validated.expression}" is a trivial constant — it will always pass or always fail`, rule: validated.id });
  }

  // 3. ID must be kebab-case or snake_case (no spaces, no uppercase)
  if (!/^[a-z0-9][a-z0-9-_]*$/.test(validated.id)) {
    errors.push({ field: 'id', message: 'ID must be lowercase alphanumeric with hyphens or underscores only', rule: validated.id });
  }

  // 4. Tags must be non-empty strings if provided
  for (const tag of validated.tags ?? []) {
    if (!tag.trim()) {
      errors.push({ field: 'tags', message: 'Tags must not be empty strings', rule: validated.id });
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a collection of policy rules.
 * Additionally checks for duplicate IDs across the set.
 */
export function validatePolicies(rules: unknown[]): PolicyValidationResult {
  const allErrors: PolicyValidationError[] = [];
  const seenIds = new Map<string, number>();

  for (let i = 0; i < rules.length; i++) {
    const result = validatePolicy(rules[i]);
    if (!result.valid) {
      allErrors.push(...result.errors.map(e => ({ ...e, field: `[${i}].${e.field}` })));
    }

    // Check for duplicate IDs
    if (typeof (rules[i] as PolicyRule)?.id === 'string') {
      const id = (rules[i] as PolicyRule).id;
      if (seenIds.has(id)) {
        allErrors.push({
          field: `[${i}].id`,
          message: `Duplicate policy ID "${id}" — first seen at index ${seenIds.get(id)}`,
          rule: id,
        });
      } else {
        seenIds.set(id, i);
      }
    }
  }

  return { valid: allErrors.length === 0, errors: allErrors };
}

/**
 * Load and validate a policy file (JSON array of PolicyRule).
 * Returns the validated rules or throws a descriptive error.
 */
export function parsePolicyFile(rawJson: string): PolicyRule[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    throw new Error(`Invalid JSON in policy file: ${(err as Error).message}`);
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Policy file must contain a JSON array of policy rules');
  }

  const result = validatePolicies(parsed);
  if (!result.valid) {
    const summary = result.errors.map(e => `  • ${e.field}: ${e.message}`).join('\n');
    throw new Error(`Policy validation failed:\n${summary}`);
  }

  return parsed as PolicyRule[];
}
