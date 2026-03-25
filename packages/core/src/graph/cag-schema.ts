import { z } from 'zod';

/**
 * Represents a code entity (class, function, interface, etc.)
 */
export const CodeEntitySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['class', 'interface', 'function', 'method', 'module', 'file', 'package', 'namespace']),
  filePath: z.string(),
  startLine: z.number().int().nonnegative(),
  endLine: z.number().int().nonnegative(),
  modifiers: z.array(z.string()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type CodeEntity = z.infer<typeof CodeEntitySchema>;

/**
 * Represents a dependency relationship between entities
 */
export const DependencySchema = z.object({
  id: z.string(),
  sourceId: z.string(),
  targetId: z.string(),
  type: z.enum(['import', 'extends', 'implements', 'calls', 'uses', 'contains']),
  weight: z.number().min(0).max(1).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type Dependency = z.infer<typeof DependencySchema>;

/**
 * Represents a module or component in the architecture
 */
export const ModuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  path: z.string(),
  type: z.enum(['layer', 'module', 'component', 'service', 'repository', 'controller', 'domain', 'infrastructure', 'ui', 'infra', 'presentation']),
  entities: z.array(z.string()),
  dependencies: z.array(z.string()),
  metrics: z.record(z.number()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export type Module = z.infer<typeof ModuleSchema>;

/**
 * Represents architectural violations detected in the codebase
 */
export const ViolationSchema = z.object({
  id: z.string(),
  ruleId: z.string(),
  severity: z.enum(['critical', 'major', 'minor', 'info']),
  message: z.string(),
  entityId: z.string(),
  filePath: z.string(),
  lineNumber: z.number().int().nonnegative(),
  context: z.string().optional(),
  remediation: z.string().optional(),
});

export type Violation = z.infer<typeof ViolationSchema>;

/**
 * Represents a policy rule for architectural governance.
 *
 * The `expression` field stores the canonical CEL representation of the rule.
 * It is used as documentation today and will be evaluated directly once a CEL
 * runtime is integrated into the engine.
 */
export const PolicyRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  expression: z.string(),
  severity: z.enum(['critical', 'major', 'minor', 'info']),
  enabled: z.boolean().default(true),
  tags: z.array(z.string()).optional(),
});

export type PolicyRule = z.infer<typeof PolicyRuleSchema>;

/**
 * Snapshot metadata stored inside the graph.
 * `commit` is optional so local (non-git) analyses are accepted.
 */
const SnapshotMetadataSchema = z.object({
  projectName: z.string(),
  projectVersion: z.string().optional(),
  sourceRoot: z.string(),
  parserVersion: z.string(),
  commit: z.string().optional(),
  totalFiles: z.number().int().nonnegative().optional(),
  totalEntities: z.number().int().nonnegative().optional(),
  totalDependencies: z.number().int().nonnegative().optional(),
});

/**
 * The main Canonical Architecture Graph (CAG) schema.
 *
 * `createdAt` and `updatedAt` are required ISO-8601 strings — they must be
 * set explicitly by the code that builds the graph object.
 */
export const CanonicalArchitectureGraphSchema = z.object({
  version: z.string(),
  createdAt: z.string().datetime({ message: 'createdAt must be an ISO-8601 datetime string' }),
  updatedAt: z.string().datetime({ message: 'updatedAt must be an ISO-8601 datetime string' }),
  metadata: SnapshotMetadataSchema,
  entities: z.array(CodeEntitySchema),
  dependencies: z.array(DependencySchema),
  modules: z.array(ModuleSchema),
  violations: z.array(ViolationSchema).optional(),
  policyRules: z.array(PolicyRuleSchema).optional(),
});

export type CanonicalArchitectureGraph = z.infer<typeof CanonicalArchitectureGraphSchema>;

/**
 * Parsed source file result
 */
export const ParsedFileSchema = z.object({
  filePath: z.string(),
  language: z.string(),
  entities: z.array(CodeEntitySchema),
  dependencies: z.array(DependencySchema),
  moduleAssignments: z.array(z.string()).optional(),
});

export type ParsedFile = z.infer<typeof ParsedFileSchema>;

/**
 * Parser configuration options
 */
export const ParserOptionsSchema = z.object({
  includePatterns: z.array(z.string()).optional(),
  excludePatterns: z.array(z.string()).optional(),
  maxFileSize: z.number().optional(),
  parseComments: z.boolean().default(false),
  extractMetadata: z.boolean().default(true),
});

export type ParserOptions = z.infer<typeof ParserOptionsSchema>;

/**
 * Parser interface that all language parsers must implement
 */
export interface Parser {
  readonly language: string;
  readonly extensions: string[];
  parse(filePath: string, content: string): Promise<ParsedFile>;
  canParse(filePath: string): boolean;
  getOptions(): ParserOptions;
}
