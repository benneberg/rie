import chalk from 'chalk';
import fs from 'fs-extra';
import path from 'path';

interface InitOptions {
  force?: boolean;
}

export async function init(options: InitOptions): Promise<void> {
  console.log(chalk.cyan('🚀 ArchLens RIE - Initializing project...\n'));

  const projectRoot = process.cwd();
  const configDir = path.join(projectRoot, '.archlens');
  const configPath = path.join(configDir, 'config.json');

  // Check if already initialized
  if (await fs.pathExists(configPath) && !options.force) {
    console.error(chalk.red('Project already initialized. Use --force to reinitialize.'));
    process.exit(1);
  }

  // Create configuration
  const config = {
    version: '2.0.0',
    project: {
      name: path.basename(projectRoot),
      root: projectRoot,
    },
    analysis: {
      include: ['**/*.ts', '**/*.tsx', '**/*.java', '**/*.py'],
      exclude: ['node_modules/**', 'dist/**', 'build/**', '.git/**'],
    },
    policies: {
      enabled: true,
      rules: [
        'layer-ui-to-infra',
        'max-coupling',
        'no-circular-deps',
        'stability-minimum',
      ],
    },
    storage: {
      type: 'local',
      path: '.archlens/snapshots',
    },
    github: {
      enabled: false,
      appId: null,
      installationId: null,
    },
  };

  // Create directories
  await fs.ensureDir(configDir);
  await fs.ensureDir(path.join(configDir, 'snapshots'));
  await fs.ensureDir(path.join(configDir, 'policies'));

  // Write configuration
  await fs.writeJson(configPath, config, { spaces: 2 });

  // Create default policies
  const defaultPolicyRules = [
    {
      id: 'layer-ui-to-infra',
      name: 'UI to Infrastructure Isolation',
      description: 'UI modules must not depend directly on infrastructure modules',
      expression: 'modules.all(m, m.type != "ui" || m.dependencies.all(d, d.targetType != "infrastructure"))',
      severity: 'critical',
      enabled: true,
      tags: ['layering', 'architecture'],
    },
    {
      id: 'max-coupling',
      name: 'Maximum Coupling Threshold',
      description: 'No module should have coupling exceeding 0.15',
      expression: 'modules.all(m, m.metrics.coupling <= 0.15)',
      severity: 'major',
      enabled: true,
      tags: ['metrics', 'coupling'],
    },
  ];

  await fs.writeJson(
    path.join(configDir, 'policies', 'default.json'),
    defaultPolicyRules,
    { spaces: 2 }
  );

  // Create .gitignore entry
  const gitignorePath = path.join(projectRoot, '.gitignore');
  let gitignore = '';
  if (await fs.pathExists(gitignorePath)) {
    gitignore = await fs.readFile(gitignorePath, 'utf-8');
  }
  
  if (!gitignore.includes('.archlens')) {
    gitignore += '\n# ArchLens\n.archlens/\n';
    await fs.writeFile(gitignorePath, gitignore);
  }

  console.log(chalk.green('✓ Project initialized successfully!\n'));
  console.log('Created files:');
  console.log(`  ${chalk.gray(configPath)}`);
  console.log(`  ${chalk.gray(path.join(configDir, 'policies', 'default.json'))}\n`);
  console.log('Next steps:');
  console.log(`  ${chalk.cyan('rie analyze')}     - Analyze your codebase`);
  console.log(`  ${chalk.cyan('rie snapshot')}    - Create a snapshot`);
  console.log(`  ${chalk.cyan('rie evaluate')}    - Run policy evaluation`);
}
