import { BaseParser } from './parser.interface.js';
import type { ParsedFile, CodeEntity, Dependency } from '../graph/cag-schema.js';

type TSNode = {
  type: string; text: string;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  children: TSNode[]; namedChildren: TSNode[];
  firstNamedChild: TSNode | null; parent: TSNode | null;
  childForFieldName(n: string): TSNode | null;
  descendantsOfType(t: string | string[]): TSNode[];
};
type TSTree = { rootNode: TSNode };
type TSParser = { setLanguage(l: unknown): void; parse(s: string): TSTree };

let pyParserInstance: TSParser | null = null;
let initFailed = false;

async function getParser(): Promise<TSParser | null> {
  if (initFailed) return null;
  if (pyParserInstance) return pyParserInstance;
  try {
    const Parser = (await import('tree-sitter')).default as new () => TSParser;
    const { default: Python } = await import('tree-sitter-python') as { default: unknown };
    const parser = new Parser();
    parser.setLanguage(Python);
    pyParserInstance = parser;
    return parser;
  } catch {
    initFailed = true;
    console.warn('PythonParser: tree-sitter bindings unavailable — falling back to regex parser');
    return null;
  }
}

export class PythonParser extends BaseParser {
  readonly language = 'python';
  readonly extensions = ['py'];

  async parse(filePath: string, content: string): Promise<ParsedFile> {
    const parser = await getParser();
    if (parser) return parseWithTreeSitter(parser, filePath, content, this);
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
  const root = parser.parse(content).rootNode;
  const entities: CodeEntity[] = [];
  const dependencies: Dependency[] = [];

  const moduleName = filePath.split('/').pop()?.replace(/\.py$/, '') ?? 'module';
  const moduleEntity: CodeEntity = {
    id: base['generateEntityId'](filePath, moduleName, 'module'),
    name: moduleName, type: 'module', filePath,
    startLine: 1, endLine: root.endPosition.row + 1,
  };
  entities.push(moduleEntity);

  // import statements: `import foo`, `import foo.bar`
  for (const node of root.descendantsOfType('import_statement')) {
    for (const nameNode of node.descendantsOfType(['dotted_name', 'identifier'])) {
      if (nameNode.parent?.type !== 'import_statement' &&
          nameNode.parent?.type !== 'aliased_import') continue;
      // Only top-level names (not sub-attributes)
      const importPath = nameNode.text;
      dependencies.push({
        id: base['generateDependencyId'](moduleEntity.id, importPath, 'import'),
        sourceId: moduleEntity.id, targetId: importPath, type: 'import',
      });
      break; // one dep per import_statement node
    }
  }

  // from … import …: `from foo import bar, baz`
  for (const node of root.descendantsOfType('import_from_statement')) {
    const moduleNameNode = node.childForFieldName('module_name')
      ?? node.descendantsOfType('dotted_name')[0]
      ?? node.descendantsOfType('relative_import')[0];
    if (!moduleNameNode) continue;
    const fromPath = moduleNameNode.text.replace(/^\.+/, ''); // strip leading dots for relative

    const importedNames = node.descendantsOfType('import_star')
      ? ['*']
      : node.descendantsOfType(['identifier', 'dotted_name'])
          .filter(n => n.parent?.type === 'aliased_import' || n.parent === node)
          .map(n => n.text)
          .filter((n, i, arr) => arr.indexOf(n) === i && n !== moduleNameNode.text);

    for (const name of importedNames.length ? importedNames : ['*']) {
      dependencies.push({
        id: base['generateDependencyId'](moduleEntity.id, `${fromPath}.${name}`, 'import'),
        sourceId: moduleEntity.id, targetId: fromPath, type: 'import',
        metadata: { importedName: name },
      });
    }
  }

  // Class definitions
  for (const node of root.descendantsOfType('class_definition')) {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) continue;
    const name = nameNode.text;
    // Skip if nested inside another class (inner classes handled separately)
    const entity: CodeEntity = {
      id: base['generateEntityId'](filePath, name, 'class'),
      name, type: 'class', filePath,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
    };
    entities.push(entity);

    // Base classes (arguments node contains them)
    const argumentsNode = node.childForFieldName('arguments');
    if (argumentsNode) {
      for (const arg of argumentsNode.namedChildren) {
        if (['identifier', 'attribute'].includes(arg.type)) {
          dependencies.push({
            id: base['generateDependencyId'](entity.id, arg.text, 'extends'),
            sourceId: entity.id, targetId: arg.text, type: 'extends',
          });
        }
      }
    }
  }

  // Function definitions (top-level and methods)
  for (const node of root.descendantsOfType('function_definition')) {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) continue;
    const name = nameNode.text;
    // Skip dunder methods
    if (name.startsWith('__') && name.endsWith('__')) continue;

    entities.push({
      id: base['generateEntityId'](filePath, name, 'function'),
      name, type: 'function', filePath,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
    });
  }

  return { filePath, language: 'python', entities, dependencies };
}

// ─── Regex fallback ───────────────────────────────────────────────────────────

function parseWithRegex(filePath: string, content: string, base: BaseParser): ParsedFile {
  const entities: CodeEntity[] = [];
  const dependencies: Dependency[] = [];

  const moduleName = filePath.split('/').pop()?.replace('.py', '') ?? 'module';
  const moduleEntity: CodeEntity = {
    id: base['generateEntityId'](filePath, moduleName, 'module'),
    name: moduleName, type: 'module', filePath,
    startLine: 1, endLine: lineCount(content),
  };
  entities.push(moduleEntity);

  const importRe = /(?:import\s+([\w.]+)|from\s+([\w.]+)\s+import\s+([\w*,\s]+))/g;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(content)) !== null) {
    if (m[1]) {
      dependencies.push({ id: base['generateDependencyId'](moduleEntity.id, m[1], 'import'), sourceId: moduleEntity.id, targetId: m[1], type: 'import' });
    } else if (m[2] && m[3]) {
      for (const name of m[3].split(',').map(n => n.trim()).filter(Boolean)) {
        dependencies.push({ id: base['generateDependencyId'](moduleEntity.id, `${m[2]}.${name}`, 'import'), sourceId: moduleEntity.id, targetId: m[2], type: 'import', metadata: { importedName: name } });
      }
    }
  }

  const classRe = /class\s+(\w+)(?:\(([^)]*)\))?/g;
  while ((m = classRe.exec(content)) !== null) {
    const entity: CodeEntity = { id: base['generateEntityId'](filePath, m[1], 'class'), name: m[1], type: 'class', filePath, startLine: lineAt(content, m.index), endLine: 0 };
    entities.push(entity);
    if (m[2]) for (const b of m[2].split(',').map(s => s.trim()).filter(Boolean)) dependencies.push({ id: base['generateDependencyId'](entity.id, b, 'extends'), sourceId: entity.id, targetId: b, type: 'extends' });
  }

  const fnRe = /(?:^|\n)(?:async\s+)?def\s+(\w+)\s*\(/gm;
  while ((m = fnRe.exec(content)) !== null) {
    if (!m[1].startsWith('__')) entities.push({ id: base['generateEntityId'](filePath, m[1], 'function'), name: m[1], type: 'function', filePath, startLine: lineAt(content, m.index), endLine: 0 });
  }

  return { filePath, language: 'python', entities, dependencies };
}

function lineAt(content: string, index: number): number {
  return (content.substring(0, index).match(/\n/g) ?? []).length + 1;
}
function lineCount(content: string): number {
  return (content.match(/\n/g) ?? []).length + 1;
}
