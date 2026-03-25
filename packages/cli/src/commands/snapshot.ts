import chalk from 'chalk';
import fs from 'fs-extra';
import nodePath from 'path';

interface SnapshotOptions {
  create?: boolean;
  list?: boolean;
  id?: string;
  commit?: string;
}

export async function snapshot(options: SnapshotOptions): Promise<void> {
  const storageDir = nodePath.join(process.cwd(), '.archlens', 'snapshots');

  if (options.list) {
    await listSnapshots(storageDir);
  } else if (options.create) {
    await createSnapshot(storageDir);
  } else if (options.id || options.commit) {
    await loadSnapshot(storageDir, options.id, options.commit);
  } else {
    console.log(chalk.cyan('🔍 ArchLens RIE - Snapshot Manager\n'));
    console.log('Usage:');
    console.log('  rie snapshot --create      Create a new snapshot');
    console.log('  rie snapshot --list        List all snapshots');
    console.log('  rie snapshot --id <id>     Load snapshot by ID');
    console.log('  rie snapshot --commit <h>  Load snapshot by commit hash');
  }
}

async function listSnapshots(storageDir: string): Promise<void> {
  console.log(chalk.cyan('📦 Snapshots\n'));

  if (!await fs.pathExists(storageDir)) {
    console.log(chalk.gray('No snapshots found. Run "rie snapshot --create" to create one.'));
    return;
  }

  const files = await fs.readdir(storageDir);
  const snapshots = files.filter(f => f.endsWith('.json')).sort().reverse();

  if (snapshots.length === 0) {
    console.log(chalk.gray('No snapshots found.'));
    return;
  }

  console.log(chalk.gray('ID                    | Commit  | Timestamp            | Files'));
  console.log(chalk.gray('─'.repeat(72)));

  for (const file of snapshots.slice(0, 10)) {
    try {
      const data = await fs.readJson(nodePath.join(storageDir, file));
      const id = file.replace('.json', '').substring(0, 20);
      const commit = (data.metadata?.commit || 'N/A').substring(0, 7);
      const timestamp = new Date(data.createdAt || data.metadata?.timestamp || Date.now()).toLocaleString();
      const fileCount = data.metadata?.totalFiles ?? 0;
      console.log(`${id.padEnd(22)} | ${commit.padEnd(7)} | ${timestamp.padEnd(21)} | ${fileCount}`);
    } catch {
      // Skip malformed snapshot files
    }
  }
}

async function createSnapshot(storageDir: string): Promise<void> {
  console.log(chalk.cyan('📦 Creating snapshot...\n'));

  let commit = 'local';
  try {
    const { execSync } = await import('child_process');
    commit = execSync('git rev-parse HEAD', { encoding: 'utf-8' }).trim().substring(0, 7);
  } catch {
    console.log(chalk.gray('Not in a git repository — using "local" as commit identifier.'));
  }

  const now = new Date().toISOString();
  const snapshotId = `snapshot-${Date.now()}-${commit}`;
  const snapshotPath = nodePath.join(storageDir, `${snapshotId}.json`);

  await fs.ensureDir(storageDir);

  // Include required CAG fields so the snapshot passes schema validation
  const snapshotData = {
    id: snapshotId,
    version: '2.0.0',
    createdAt: now,
    updatedAt: now,
    metadata: {
      projectName: nodePath.basename(process.cwd()),
      sourceRoot: process.cwd(),
      parserVersion: '1.0.0',
      commit,
    },
    modules: [],
    entities: [],
    dependencies: [],
    violations: [],
  };

  await fs.writeJson(snapshotPath, snapshotData, { spaces: 2 });

  console.log(chalk.green(`✓ Created snapshot: ${snapshotId}`));
  console.log(chalk.gray(`  Location: ${snapshotPath}`));
  console.log(chalk.gray('\nTip: run "rie analyze --output <file>" first, then use that file as a snapshot.'));
}

async function loadSnapshot(storageDir: string, id?: string, commit?: string): Promise<void> {
  if (!id && !commit) {
    console.error(chalk.red('Error: must specify either --id or --commit'));
    return;
  }

  console.log(chalk.cyan('📦 Loading snapshot...\n'));

  if (!await fs.pathExists(storageDir)) {
    console.error(chalk.red('No snapshots found. Run "rie snapshot --create" first.'));
    return;
  }

  const files = await fs.readdir(storageDir);
  const snapshots = files.filter(f => f.endsWith('.json'));

  const found = id
    ? snapshots.find(f => f.includes(id))
    : snapshots.find(f => f.includes(commit!));

  if (!found) {
    console.error(chalk.red(`Snapshot not found: ${id ?? commit}`));
    return;
  }

  const data = await fs.readJson(nodePath.join(storageDir, found));
  console.log(chalk.green(`✓ Loaded snapshot: ${found}`));
  console.log(JSON.stringify(data, null, 2));
}
