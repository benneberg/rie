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

let javaParserInstance: TSParser | null = null;
let initFailed = false;

async function getParser(): Promise<TSParser | null> {
  if (initFailed) return null;
  if (javaParserInstance) return javaParserInstance;
  try {
    const Parser = (await import('tree-sitter')).default as new () => TSParser;
    const { default: Java } = await import('tree-sitter-java') as { default: unknown };
    const parser = new Parser();
    parser.setLanguage(Java);
    javaParserInstance = parser;
    return parser;
  } catch {
    initFailed = true;
    console.warn('JavaParser: tree-sitter bindings unavailable — falling back to regex parser');
    return null;
  }
}

export class JavaParser extends BaseParser {
  readonly language = 'java';
  readonly extensions = ['java'];

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

  // Package declaration → becomes the file-level entity
  const pkgDecl = root.descendantsOfType('package_declaration')[0];
  const packageName = pkgDecl?.descendantsOfType('scoped_identifier')[0]?.text
    ?? pkgDecl?.descendantsOfType('identifier')[0]?.text
    ?? 'default';

  const packageEntity: CodeEntity = {
    id: base['generateEntityId'](filePath, packageName, 'package'),
    name: packageName, type: 'package', filePath,
    startLine: 1, endLine: root.endPosition.row + 1,
  };
  entities.push(packageEntity);

  // Import declarations
  for (const node of root.descendantsOfType('import_declaration')) {
    // Full import path is the scoped_identifier or identifier child
    const pathNode = node.descendantsOfType('scoped_identifier')[0]
      ?? node.descendantsOfType('identifier')[0];
    if (!pathNode) continue;
    const importPath = pathNode.text;
    dependencies.push({
      id: base['generateDependencyId'](packageEntity.id, importPath, 'import'),
      sourceId: packageEntity.id,
      targetId: importPath,
      type: 'import',
      metadata: { importPath },
    });
  }

  // Class / interface / enum declarations
  for (const node of root.descendantsOfType([
    'class_declaration',
    'interface_declaration',
    'enum_declaration',
    'annotation_type_declaration',
  ])) {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) continue;
    const name = nameNode.text;
    const type = node.type === 'interface_declaration' ? 'interface' : 'class';

    const entity: CodeEntity = {
      id: base['generateEntityId'](filePath, name, type),
      name, type, filePath,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      modifiers: getModifiers(node),
    };
    entities.push(entity);

    // extends (classes only — single superclass)
    const superclassNode = node.childForFieldName('superclass');
    if (superclassNode) {
      const superName = superclassNode.descendantsOfType('type_identifier')[0]?.text
        ?? superclassNode.text;
      dependencies.push({
        id: base['generateDependencyId'](entity.id, superName, 'extends'),
        sourceId: entity.id, targetId: superName, type: 'extends',
      });
    }

    // implements
    const interfaces = node.childForFieldName('interfaces');
    if (interfaces) {
      for (const typeRef of interfaces.descendantsOfType('type_identifier')) {
        dependencies.push({
          id: base['generateDependencyId'](entity.id, typeRef.text, 'implements'),
          sourceId: entity.id, targetId: typeRef.text, type: 'implements',
        });
      }
    }

    // interface extends
    const extendsInterfaces = node.childForFieldName('extends_interfaces');
    if (extendsInterfaces) {
      for (const typeRef of extendsInterfaces.descendantsOfType('type_identifier')) {
        dependencies.push({
          id: base['generateDependencyId'](entity.id, typeRef.text, 'extends'),
          sourceId: entity.id, targetId: typeRef.text, type: 'extends',
        });
      }
    }
  }

  // Method declarations — record as method entities
  for (const node of root.descendantsOfType('method_declaration')) {
    const nameNode = node.childForFieldName('name');
    if (!nameNode) continue;
    entities.push({
      id: base['generateEntityId'](filePath, nameNode.text, 'method'),
      name: nameNode.text, type: 'method', filePath,
      startLine: node.startPosition.row + 1,
      endLine: node.endPosition.row + 1,
      modifiers: getModifiers(node),
    });
  }

  return { filePath, language: 'java', entities, dependencies };
}

function getModifiers(node: TSNode): string[] {
  const mods: string[] = [];
  for (const child of node.namedChildren) {
    if (child.type === 'modifiers') {
      for (const mod of child.namedChildren) mods.push(mod.text);
    }
  }
  return mods;
}

// ─── Regex fallback ───────────────────────────────────────────────────────────

function parseWithRegex(filePath: string, content: string, base: BaseParser): ParsedFile {
  const entities: CodeEntity[] = [];
  const dependencies: Dependency[] = [];

  const pkgMatch = content.match(/package\s+([\w.]+);/);
  const packageName = pkgMatch?.[1] ?? 'default';
  const moduleEntity: CodeEntity = {
    id: base['generateEntityId'](filePath, packageName, 'package'),
    name: packageName, type: 'package', filePath,
    startLine: 1, endLine: lineCount(content),
  };
  entities.push(moduleEntity);

  const importRe = /import\s+(?:static\s+)?([\w.]+)(?:\.([\w*]+))?;/g;
  let m: RegExpExecArray | null;
  while ((m = importRe.exec(content)) !== null) {
    const importedPackage = m[1];
    dependencies.push({
      id: base['generateDependencyId'](moduleEntity.id, importedPackage, 'import'),
      sourceId: moduleEntity.id, targetId: importedPackage, type: 'import',
      metadata: { importedName: m[2] ?? '*' },
    });
  }

  const classRe = /(?:(?:public|private|protected|abstract|final|static)\s+)*(?:class|interface|enum)\s+(\w+)(?:<[^>]+>)?(?:\s+extends\s+([\w.]+))?(?:\s+implements\s+([^{]+))?/g;
  while ((m = classRe.exec(content)) !== null) {
    const entity: CodeEntity = {
      id: base['generateEntityId'](filePath, m[1], 'class'),
      name: m[1], type: 'class', filePath,
      startLine: lineAt(content, m.index), endLine: 0,
    };
    entities.push(entity);
    if (m[2]) dependencies.push({ id: base['generateDependencyId'](entity.id, m[2], 'extends'), sourceId: entity.id, targetId: m[2], type: 'extends' });
    if (m[3]) for (const i of m[3].split(',').map(s => s.trim()).filter(Boolean)) dependencies.push({ id: base['generateDependencyId'](entity.id, i, 'implements'), sourceId: entity.id, targetId: i, type: 'implements' });
  }

  return { filePath, language: 'java', entities, dependencies };
}

function lineAt(content: string, index: number): number {
  return (content.substring(0, index).match(/\n/g) ?? []).length + 1;
}
function lineCount(content: string): number {
  return (content.match(/\n/g) ?? []).length + 1;
}
