import chalk from 'chalk';
import fs from 'fs-extra';
import nodePath from 'path';
import { ParserRegistry, CanonicalArchitectureGraphSchema } from '@archlens/core';

interface AnalyzeOptions {
  output?: string;
  format: 'json' | 'yaml';
  cache: boolean;
}

export async function analyze(sourcePath: string, options: AnalyzeOptions): Promise<void> {
  console.log(chalk.cyan('🔍 ArchLens RIE - Analyzing architecture...\n'));

  const startTime = performance.now();

  try {
    // Check if path exists
    if (!await fs.pathExists(sourcePath)) {
      console.error(chalk.red(`❌ Path does not exist: ${sourcePath}`));
      process.exit(1);
    }

    // Initialize parser registry
    const registry = new ParserRegistry();
    console.log(chalk.gray(`   Supported languages: ${registry.getLanguages().join(', ')}`));

    // Find source files
    const files = await findSourceFiles(sourcePath, registry);
    console.log(chalk.gray(`   Found ${files.length} source files\n`));

    // Parse files and accumulate results
    let parsedCount = 0;
    let errorCount = 0;
    const allEntities: unknown[] = [];
    const allDependencies: unknown[] = [];

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const parsed = await registry.parse(file, content);
        allEntities.push(...parsed.entities);
        allDependencies.push(...parsed.dependencies);
        parsedCount++;

        if (parsedCount % 100 === 0) {
          process.stdout.write(chalk.gray(`   Parsed ${parsedCount}/${files.length} files\r`));
        }
      } catch {
        errorCount++;
      }
    }

    console.log(chalk.gray(`\n   ✓ Parsed ${parsedCount} files, ${errorCount} errors\n`));

    const now = new Date().toISOString();

    // Build and validate graph — createdAt/updatedAt are required by schema
    const graph = {
      version: '2.0.0',
      createdAt: now,
      updatedAt: now,
      metadata: {
        projectName: nodePath.basename(sourcePath),
        sourceRoot: sourcePath,
        parserVersion: '1.0.0',
        totalFiles: files.length,
        totalEntities: allEntities.length,
        totalDependencies: allDependencies.length,
      },
      modules: [],
      entities: allEntities,
      dependencies: allDependencies,
      violations: [],
    };

    const validated = CanonicalArchitectureGraphSchema.parse(graph);

    const endTime = performance.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    if (options.output) {
      // Resolve relative to CWD — NOT to sourcePath (that was the original bug)
      const outputPath = nodePath.resolve(process.cwd(), options.output);

      if (options.format === 'yaml') {
        await fs.writeFile(outputPath, jsonToYaml(validated));
      } else {
        await fs.writeFile(outputPath, JSON.stringify(validated, null, 2));
      }
      console.log(chalk.green(`✓ Saved architecture graph to ${outputPath}`));
    } else {
      console.log(chalk.green(`✓ Analysis complete in ${duration}s`));
      console.log(chalk.gray(JSON.stringify(validated.metadata, null, 2)));
    }

  } catch (error) {
    console.error(chalk.red('\n❌ Analysis failed:'), error);
    process.exit(1);
  }
}

/**
 * Minimal JSON → YAML serialiser.
 * Avoids pulling in js-yaml for what is essentially a dev convenience output.
 */
function jsonToYaml(value: unknown, indent = 0): string {
  const pad = '  '.repeat(indent);

  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean' || typeof value === 'number') return `${value}`;
  if (typeof value === 'string') {
    if (/[:\-#[\]{},|>&*!'"@`%]/.test(value) || value.includes('\n')) {
      return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    }
    return value;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]\n';
    return value.map(item => {
      const rendered = jsonToYaml(item, indent + 1);
      return `${pad}- ${rendered.trimStart()}\n`;
    }).join('');
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return '{}\n';
    return entries.map(([k, v]) => {
      if (typeof v === 'object' && v !== null) {
        return `${pad}${k}:\n${jsonToYaml(v, indent + 1)}`;
      }
      return `${pad}${k}: ${jsonToYaml(v, indent + 1)}\n`;
    }).join('');
  }

  return `${value}`;
}

async function findSourceFiles(dir: string, registry: ParserRegistry): Promise<string[]> {
  const files: string[] = [];
  const extensions = new Set<string>();

  for (const parser of registry.getAllParsers()) {
    for (const ext of parser.extensions) {
      extensions.add(ext);
    }
  }

  const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', '.next', '.archlens', 'coverage']);

  async function walk(currentDir: string): Promise<void> {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = nodePath.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name)) {
          await walk(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = entry.name.split('.').pop()?.toLowerCase();
        if (ext && extensions.has(ext)) {
          files.push(fullPath);
        }
      }
    }
  }

  await walk(dir);
  return files;
}
