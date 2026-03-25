import { BaseParser } from './parser.interface.js';
import type { ParsedFile, CodeEntity, Dependency } from '../graph/cag-schema.js';

// tree-sitter is a native addon — import dynamically so the package degrades
// gracefully if bindings are not compiled (e.g. in a pure-JS test environment).
// The fallback regex parser is still available via TypeScriptRegexParser if needed.
type TSNode = {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  childCount: number;
  children: TSNode[];
  namedChildren: TSNode[];
  namedChildCount: number;
  firstNamedChild: TSNode | null;
  parent: TSNode | null;
  isNamed: boolean;
  hasError: boolean;
  childForFieldName(name: string): TSNode | null;
  descendantsOfType(type: string | string[]): TSNode[];
};

type TSTree = { rootNode: TSNode };
type TSParser = {
  setLanguage(lang: unknown): void;
  parse(src: string): TSTree;
};

let tsParserInstance: TSParser | null = null;
let tsLanguage: unknown = null;
let parserInitFailed = false;

async function getParser(): Promise<TSParser | null> {
  if (parserInitFailed) return null;
  if (tsParserInstance) return tsParserInstance;
  try {
    const Parser = (await import('tree-sitter')).default as new () => TSParser;
    const { default: TypeScript } = await import('tree-sitter-typescript') as {
      default: { typescript: unknown; tsx: unknown };
    };
    const parser = new Parser();
    tsLanguage = (TypeScript as { typescript: unknown }).typescript;
    parser.setLanguage(tsLanguage);
    tsParserInstance = parser;
    return parser;
  } catch {
    parserInitFailed = true;
    console.warn('TypeScriptParser: tree-sitter bindings unavailable — falling back to regex parser');
    return null;
  }
}

export class TypeScriptParser extends BaseParser {
  readonly language = 'typescript';
  readonly extensions = ['ts', 'tsx'];

  async parse(filePath: string, content: string): Promise<ParsedFile> {
    const parser = await getParser();
    if (parser) {
      return parseWithTreeSitter(parser, filePath, content, this);
    }
    return parseWithRegex(filePath, content, this);
  }
}

// ─── tree-sitter implementation ───────────────────────────────────────────────

function parseWithTreeSitter(
  parser: TSParser,
  filePath: string,
  content: string,
  base: BaseParser,
): ParsedFile {
  const tree = parser.parse(content);
  const root = tree.rootNode;

  const entities: CodeEntity[] = [];
  const dependencies: Dependency[] = [];

  // File-level module entity
  const fileEntity: CodeEntity = {
    id: base['generateEntityId'](filePath, 'module', 'module'),
    name: 'module',
    type: 'module',
    filePath,
    startLine: 1,
    endLine: root.endPosition.row + 1,
  };
  entities.push(fileEntity);

  // ── Imports ──────────────────────────────────────────────────────────────
  for (const node of root.descendantsOfType('import_statement')) {
    const sourceNode = node.childForFieldName('source');
    const modulePath = sourceNode?.text.replace(/['"]/g, '') ?? '';
    if (!modulePath) continue;

    const clauseNode = node.childForFieldName('import_clause');
    const names = extractImportNames(clauseNode);

    for (const name of names.length ? names : ['(side-effect)']) {
      const targetId = base['generateEntityId'](modulePath, name, 'import');
      dependencies.push({
        id: base['generateDependencyId'](fileEntity.id, targetId, 'import'),
        sourceId: fileEntity.id,
        targetId,
        type: 'import',
        metadata: { modulePath, importedName: name },
      });
    }
  }

  // ── Export-from (re-exports) ──────────────────────────────────────────────
  for (const node of root.descendantsOfType('export_statement')) {
    const sourceNode = node.childForFieldName('source');
    if (!sourceNode) continue;
    const modulePath = sourceNode.text.replace(/['"]/g, '');
    const clauseNode = node.childForFieldName('export_clause');
    const names = clauseNode
      ? clauseNode.descendantsOfType('export_specifier').map(s => {
          const orig = s.childForFieldName('name');
          return orig?.text ?? s.text;
        })
      : ['*'];

    for (const name of names) {
      const targetId = base['generateEntityId'](modulePath, name, 'import');
      dependencies.push({
        id: base['generateDependencyId'](fileEntity.id, targetId, 'import'),
        sourceId: fileEntity.id,
        targetId,
        type: 'import',
        metadata: { modulePath, importedName: name, reExport: true },
      });
    }
  }

  // ── Classes ──────────────────────────────────────────────────────────────
  for (const node of root.descendantsOfType('class_declaration')) {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) continue;
    const className = nameNode.text;

    const entity: CodeEntity = {
      id: base['generateEntityId'](filePath, className, 'class'),
      name: className,
      type: 'class',
      filePath,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      modifiers: getModifiers(node),
    };
    entities.push(entity);

    // extends
    const heritageNode = node.childForFieldName('class_heritage');
    if (heritageNode) {
      for (const clause of heritageNode.descendantsOfType('extends_clause')) {
        const typeNode = clause.descendantsOfType('type_identifier')[0] ??
          clause.descendantsOfType('identifier')[0];
        if (typeNode) {
          dependencies.push({
            id: base['generateDependencyId'](entity.id, typeNode.text, 'extends'),
            sourceId: entity.id,
            targetId: typeNode.text,
            type: 'extends',
          });
        }
      }
      for (const clause of heritageNode.descendantsOfType('implements_clause')) {
        for (const typeRef of clause.descendantsOfType('type_identifier')) {
          dependencies.push({
            id: base['generateDependencyId'](entity.id, typeRef.text, 'implements'),
            sourceId: entity.id,
            targetId: typeRef.text,
            type: 'implements',
          });
        }
      }
    }
  }

  // ── Interfaces ───────────────────────────────────────────────────────────
  for (const node of root.descendantsOfType('interface_declaration')) {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) continue;
    const name = nameNode.text;

    const entity: CodeEntity = {
      id: base['generateEntityId'](filePath, name, 'interface'),
      name,
      type: 'interface',
      filePath,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      modifiers: getModifiers(node),
    };
    entities.push(entity);

    const extendsClause = node.childForFieldName('extends_clause');
    if (extendsClause) {
      for (const typeRef of extendsClause.descendantsOfType('type_identifier')) {
        dependencies.push({
          id: base['generateDependencyId'](entity.id, typeRef.text, 'extends'),
          sourceId: entity.id,
          targetId: typeRef.text,
          type: 'extends',
        });
      }
    }
  }

  // ── Functions ────────────────────────────────────────────────────────────
  for (const node of root.descendantsOfType([
    'function_declaration',
    'generator_function_declaration',
  ])) {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) continue;
    entities.push({
      id: base['generateEntityId'](filePath, nameNode.text, 'function'),
      name: nameNode.text,
      type: 'function',
      filePath,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      modifiers: getModifiers(node),
    });
  }

  // ── Arrow / const functions ───────────────────────────────────────────────
  for (const node of root.descendantsOfType('lexical_declaration')) {
    for (const decl of node.descendantsOfType('variable_declarator')) {
      const nameNode = decl.childForFieldName('name');
      const valueNode = decl.childForFieldName('value');
      if (!nameNode || !valueNode) continue;
      if (!['arrow_function', 'function'].includes(valueNode.type)) continue;
      entities.push({
        id: base['generateEntityId'](filePath, nameNode.text, 'function'),
        name: nameNode.text,
        type: 'function',
        filePath,
        startLine: node.startPosition.row + 1,
        endLine: node.endPosition.row + 1,
        modifiers: getModifiers(node),
      });
    }
  }

  return { filePath, language: 'typescript', entities, dependencies };
}

function extractImportNames(clause: TSNode | null): string[] {
  if (!clause) return [];
  const names: string[] = [];
  // default import: `import Foo from ...`
  const defaultId = clause.childForFieldName('name') ??
    clause.namedChildren.find(c => c.type === 'identifier');
  if (defaultId) names.push(defaultId.text);
  // named imports: `import { X, Y as Z } from ...`
  for (const spec of clause.descendantsOfType('import_specifier')) {
    const orig = spec.childForFieldName('name') ?? spec.namedChildren[0];
    if (orig) names.push(orig.text);
  }
  // namespace: `import * as X from ...`
  for (const ns of clause.descendantsOfType('namespace_import')) {
    const id = ns.descendantsOfType('identifier')[0];
    if (id) names.push(`* as ${id.text}`);
  }
  return names;
}

function getModifiers(node: TSNode): string[] {
  const mods: string[] = [];
  if (node.parent?.type === 'export_statement') mods.push('export');
  for (const child of node.namedChildren) {
    if (['abstract', 'declare', 'async', 'static'].includes(child.type)) {
      mods.push(child.type);
    }
  }
  return mods;
}

// ─── Regex fallback (kept from previous iteration, comment-stripped) ──────────

function parseWithRegex(filePath: string, content: string, base: BaseParser): ParsedFile {
  const stripped = stripComments(content);
  const entities: CodeEntity[] = [];
  const dependencies: Dependency[] = [];

  const fileEntity: CodeEntity = {
    id: base['generateEntityId'](filePath, 'module', 'module'),
    name: 'module', type: 'module', filePath, startLine: 1, endLine: 0,
  };
  entities.push(fileEntity);

  const importRe = /import\s+(?:type\s+)?(?:{([^}]+)}|(\w+)|\*\s+as\s+(\w+))?\s*(?:,\s*{([^}]+)})?\s*from\s+['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(stripped)) !== null) {
    const modulePath = m[5];
    const names: string[] = [];
    if (m[1] || m[4]) names.push(...((m[1] ?? m[4]).split(',').map(n => n.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean)));
    if (m[2]) names.push(m[2]);
    if (m[3]) names.push(`* as ${m[3]}`);
    for (const name of names.length ? names : ['(side-effect)']) {
      const targetId = base['generateEntityId'](modulePath, name, 'import');
      dependencies.push({ id: base['generateDependencyId'](fileEntity.id, targetId, 'import'), sourceId: fileEntity.id, targetId, type: 'import', metadata: { modulePath, importedName: name } });
    }
  }

  const classRe = /export\s+(?:abstract\s+)?class\s+(\w+)(?:<[^>]+>)?(?:\s+extends\s+([\w.]+)(?:<[^>]+>)?)?(?:\s+implements\s+([^{]+))?/g;
  while ((m = classRe.exec(stripped)) !== null) {
    const entity: CodeEntity = { id: base['generateEntityId'](filePath, m[1], 'class'), name: m[1], type: 'class', filePath, startLine: lineAt(content, m.index), endLine: 0, modifiers: ['export'] };
    entities.push(entity);
    if (m[2]) dependencies.push({ id: base['generateDependencyId'](entity.id, m[2], 'extends'), sourceId: entity.id, targetId: m[2], type: 'extends' });
    if (m[3]) for (const i of m[3].split(',').map(s => s.trim().split('<')[0].trim()).filter(Boolean)) dependencies.push({ id: base['generateDependencyId'](entity.id, i, 'implements'), sourceId: entity.id, targetId: i, type: 'implements' });
  }

  const ifaceRe = /export\s+interface\s+(\w+)(?:<[^>]+>)?(?:\s+extends\s+([^{]+))?/g;
  while ((m = ifaceRe.exec(stripped)) !== null) {
    const entity: CodeEntity = { id: base['generateEntityId'](filePath, m[1], 'interface'), name: m[1], type: 'interface', filePath, startLine: lineAt(content, m.index), endLine: 0, modifiers: ['export'] };
    entities.push(entity);
    if (m[2]) for (const i of m[2].split(',').map(s => s.trim().split('<')[0].trim()).filter(Boolean)) dependencies.push({ id: base['generateDependencyId'](entity.id, i, 'extends'), sourceId: entity.id, targetId: i, type: 'extends' });
  }

  const fnRe = /export\s+(?:async\s+)?function\s+(\w+)/g;
  while ((m = fnRe.exec(stripped)) !== null) entities.push({ id: base['generateEntityId'](filePath, m[1], 'function'), name: m[1], type: 'function', filePath, startLine: lineAt(content, m.index), endLine: 0, modifiers: ['export'] });

  const arrowRe = /export\s+const\s+(\w+)\s*=\s*(?:async\s+)?\(/g;
  while ((m = arrowRe.exec(stripped)) !== null) entities.push({ id: base['generateEntityId'](filePath, m[1], 'function'), name: m[1], type: 'function', filePath, startLine: lineAt(content, m.index), endLine: 0, modifiers: ['export'] });

  return { filePath, language: 'typescript', entities, dependencies };
}

function lineAt(content: string, index: number): number {
  return (content.substring(0, index).match(/\n/g) ?? []).length + 1;
}

function stripComments(source: string): string {
  let result = ''; let i = 0;
  while (i < source.length) {
    if (source[i] === '"' || source[i] === "'" || source[i] === '`') {
      const q = source[i]; result += source[i++];
      while (i < source.length) { if (source[i] === '\\') { result += source[i++]; result += source[i++]; } else if (source[i] === q) { result += source[i++]; break; } else { result += source[i++]; } }
    } else if (source[i] === '/' && source[i+1] === '*') { i += 2; while (i < source.length && !(source[i] === '*' && source[i+1] === '/')) { result += source[i] === '\n' ? '\n' : ' '; i++; } i += 2;
    } else if (source[i] === '/' && source[i+1] === '/') { i += 2; while (i < source.length && source[i] !== '\n') { result += ' '; i++; }
    } else { result += source[i++]; }
  }
  return result;
}
