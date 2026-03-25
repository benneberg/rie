import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';
import { diffLines } from 'diff';

interface DiffOptions {
  output?: string;
  format: 'text' | 'json';
}

export async function diff(from: string, to: string, options: DiffOptions): Promise<void> {
  console.log(chalk.cyan('📊 ArchLens RIE - Architecture Diff\n'));
  
  console.log(chalk.gray(`   Comparing: ${chalk.white(from)} → ${chalk.white(to)}\n`));

  try {
    // Load snapshots (mock implementation)
    const fromData = await loadSnapshot(from);
    const toData = await loadSnapshot(to);

    if (!fromData || !toData) {
      console.error(chalk.red('Failed to load one or both snapshots'));
      process.exit(1);
    }

    // Calculate differences
    const differences = calculateDifferences(fromData, toData);

    // Format output
    if (options.format === 'json') {
      const output = JSON.stringify(differences, null, 2);
      if (options.output) {
        await fs.writeFile(options.output, output);
        console.log(chalk.green(`✓ Diff saved to ${options.output}`));
      } else {
        console.log(output);
      }
    } else {
      // Text format
      printDiff(differences, options.output);
    }

  } catch (error) {
    console.error(chalk.red('\n❌ Diff failed:'), error);
    process.exit(1);
  }
}

function calculateDifferences(from: any, to: any) {
  const added: any[] = [];
  const removed: any[] = [];
  const changed: any[] = [];

  const fromModules = new Map(from.modules?.map((m: any) => [m.id, m]) || []);
  const toModules = new Map(to.modules?.map((m: any) => [m.id, m]) || []);

  // Find added and changed modules
  for (const [id, module] of toModules) {
    if (!fromModules.has(id)) {
      added.push(module);
    } else {
      const fromModule = fromModules.get(id);
      const changes = {};
      let hasChanges = false;

      if (module.metrics?.stability !== fromModule.metrics?.stability) {
        (changes as any).stability = {
          from: fromModule.metrics?.stability,
          to: module.metrics?.stability,
        };
        hasChanges = true;
      }

      if (module.metrics?.coupling !== fromModule.metrics?.coupling) {
        (changes as any).coupling = {
          from: fromModule.metrics?.coupling,
          to: module.metrics?.coupling,
        };
        hasChanges = true;
      }

      if (hasChanges) {
        changed.push({ module: id, changes });
      }
    }
  }

  // Find removed modules
  for (const [id] of fromModules) {
    if (!toModules.has(id)) {
      removed.push({ id });
    }
  }

  return {
    from: from.metadata?.commit || from.id,
    to: to.metadata?.commit || to.id,
    added,
    removed,
    changed,
    summary: {
      addedCount: added.length,
      removedCount: removed.length,
      changedCount: changed.length,
    },
  };
}

function printDiff(differences: any, outputPath?: string): void {
  let output = '';

  output += chalk.cyan('┌─────────────────────────────────────────┐\n');
  output += '│           Architecture Diff Report        │\n';
  output += '└─────────────────────────────────────────┘\n\n';

  // Summary
  output += `Changes: +${differences.summary.addedCount} -${differences.summary.removedCount} ~${differences.summary.changedCount}\n\n`;

  // Added modules
  if (differences.added.length > 0) {
    output += chalk.green('➕ Added Modules\n');
    output += chalk.gray('─'.repeat(40)) + '\n';
    for (const item of differences.added) {
      output += `  • ${item.name || item.id}\n`;
      output += chalk.gray(`    Type: ${item.type}\n`);
      if (item.metrics?.stability) {
        output += chalk.gray(`    Stability: ${(item.metrics.stability * 100).toFixed(0)}%\n`);
      }
    }
    output += '\n';
  }

  // Removed modules
  if (differences.removed.length > 0) {
    output += chalk.red('➖ Removed Modules\n');
    output += chalk.gray('─'.repeat(40)) + '\n';
    for (const item of differences.removed) {
      output += `  • ${item.id}\n`;
    }
    output += '\n';
  }

  // Changed modules
  if (differences.changed.length > 0) {
    output += chalk.yellow('～ Changed Modules\n');
    output += chalk.gray('─'.repeat(40)) + '\n';
    for (const item of differences.changed) {
      output += `  • ${item.module}\n`;
      for (const [key, change] of Object.entries(item.changes)) {
        const c = change as any;
        const delta = c.to - c.from;
        const sign = delta >= 0 ? '+' : '';
        output += chalk.gray(`    ${key}: ${(c.from * 100).toFixed(0)}% → ${(c.to * 100).toFixed(0)}% (${sign}${(delta * 100).toFixed(0)}%)\n`);
      }
    }
  }

  if (outputPath) {
    fs.writeFileSync(outputPath, output);
    console.log(chalk.green(`\n✓ Diff saved to ${outputPath}`));
  } else {
    console.log(output);
  }
}

async function loadSnapshot(identifier: string): Promise<any | null> {
  const storageDir = path.join(process.cwd(), '.archlens', 'snapshots');
  
  if (!await fs.pathExists(storageDir)) {
    return null;
  }

  const files = await fs.readdir(storageDir);
  const snapshot = files.find(f => f.includes(identifier));

  if (!snapshot) {
    return null;
  }

  return fs.readJson(path.join(storageDir, snapshot));
}
