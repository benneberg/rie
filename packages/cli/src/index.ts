#!/usr/bin/env node

import { Command } from 'commander';
import { analyze } from './commands/analyze.js';
import { snapshot } from './commands/snapshot.js';
import { diff } from './commands/diff.js';
import { evaluate } from './commands/evaluate.js';
import { init } from './commands/init.js';

const program = new Command();

program
  .name('rie')
  .description('ArchLens RIE — Architecture Intelligence Engine')
  .version('2.0.0');

program
  .command('analyze')
  .description('Analyze source code and generate an architecture graph')
  .argument('[path]', 'Path to source root', process.cwd())
  .option('-o, --output <file>', 'Output file path')
  .option('-f, --format <format>', 'Output format: json | yaml', 'json')
  .option('--no-cache', 'Skip cache and force full analysis')
  .action(analyze);

program
  .command('snapshot')
  .description('Create or browse architecture snapshots')
  .option('-c, --create', 'Create a new snapshot from the latest analysis')
  .option('-l, --list', 'List all snapshots')
  .option('--id <id>', 'Load snapshot by ID')
  .option('--commit <hash>', 'Load snapshot by commit hash')
  .action(snapshot);

program
  .command('diff')
  .description('Compare two architecture snapshots')
  .argument('<from>', 'Source snapshot (ID or commit hash)')
  .argument('<to>', 'Target snapshot (ID or commit hash)')
  .option('-o, --output <file>', 'Output file path')
  .option('--format <format>', 'Output format: text | json', 'text')
  .action(diff);

program
  .command('evaluate')
  .description('Evaluate an architecture graph against policy rules')
  .argument('[graph]', 'Path to architecture graph JSON (or pipe via stdin)')
  .option('-p, --policies <path>', 'Path to custom policy rules file', '.archlens/policies/default.json')
  .option('--validate', 'Validate policy files only — do not evaluate')
  .option('--strict', 'Exit with code 1 on policy violations')
  .option('--fail-level <level>', 'Minimum severity to treat as failure: critical | major | minor | info', 'major')
  .action(evaluate);

program
  .command('init')
  .description('Initialise ArchLens in the current project')
  .option('--force', 'Overwrite existing configuration')
  .action(init);

program.parse();
