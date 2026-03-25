// Core graph schema and types
export {
  CanonicalArchitectureGraphSchema,
  CodeEntitySchema,
  DependencySchema,
  ModuleSchema,
  ViolationSchema,
  PolicyRuleSchema,
  ParsedFileSchema,
  ParserOptionsSchema,
  type CanonicalArchitectureGraph,
  type CodeEntity,
  type Dependency,
  type Module,
  type Violation,
  type PolicyRule,
  type ParsedFile,
  type ParserOptions,
  type Parser,
} from './graph/cag-schema.js';

// Parser interface and implementations
export { BaseParser } from './parsers/parser.interface.js';
export { TypeScriptParser } from './parsers/typescript.parser.js';
export { JavaParser } from './parsers/java.parser.js';
export { PythonParser } from './parsers/python.parser.js';
export { ParserRegistry, defaultRegistry } from './parsers/registry.js';
