import { promises as fsp } from 'fs';
import path from 'path';
import type { CanonicalArchitectureGraph, Violation, PolicyRule } from '@archlens/core';
import type { StorageBackend, StorageConfig, SnapshotMetadata } from './storage.interface.js';
import { ReadCache } from './storage.interface.js';

/**
 * Local filesystem storage backend.
 *
 * Layout on disk:
 *   <root>/
 *     snapshots/
 *       <id>.json          — full CAG snapshot
 *     violations/
 *       <snapshotId>.json  — violations array
 *     policies.json        — policy rules array
 *     index.json           — ordered list of snapshot metadata (newest first)
 *
 * This backend is the default for local CLI usage and tests.
 * It does not require any external service.
 */
export class LocalStorage implements StorageBackend {
  private root: string;
  private snapshotsDir: string;
  private violationsDir: string;
  private policiesFile: string;
  private indexFile: string;
  private cache: ReadCache<CanonicalArchitectureGraph>;
  private config: StorageConfig;

  constructor(config: StorageConfig) {
    if (config.type !== 'local') {
      throw new Error('LocalStorage requires type "local"');
    }
    this.config = { enableCache: true, cacheTtl: 300, ...config };
    this.root = config.connectionString;
    this.snapshotsDir = path.join(this.root, 'snapshots');
    this.violationsDir = path.join(this.root, 'violations');
    this.policiesFile = path.join(this.root, 'policies.json');
    this.indexFile = path.join(this.root, 'index.json');
    this.cache = new ReadCache<CanonicalArchitectureGraph>(this.config.cacheTtl ?? 300);
  }

  async initialize(): Promise<void> {
    await fsp.mkdir(this.snapshotsDir, { recursive: true });
    await fsp.mkdir(this.violationsDir, { recursive: true });
    // Ensure index exists
    try {
      await fsp.access(this.indexFile);
    } catch {
      await this.writeJson(this.indexFile, []);
    }
    console.log(`LocalStorage: initialised at ${this.root}`);
  }

  async close(): Promise<void> {
    this.cache.clear();
  }

  async saveSnapshot(graph: CanonicalArchitectureGraph): Promise<string> {
    const commit = graph.metadata.commit ?? 'local';
    const id = `snapshot-${Date.now()}-${commit.slice(0, 7)}`;
    const snapshotPath = path.join(this.snapshotsDir, `${id}.json`);
    const serialised = JSON.stringify(graph, null, 2);

    await fsp.writeFile(snapshotPath, serialised, 'utf-8');

    if (this.config.enableCache) {
      this.cache.set(id, graph);
    }

    // Update index
    const meta: SnapshotMetadata = {
      id,
      commit,
      timestamp: graph.createdAt,
      metrics: {
        totalModules: graph.modules.length,
        totalEntities: graph.entities.length,
        totalDependencies: graph.dependencies.length,
        fileSize: Buffer.byteLength(serialised),
      },
    };

    const index = await this.readIndex();
    index.unshift(meta); // newest first
    await this.writeJson(this.indexFile, index);

    console.log(`LocalStorage: saved snapshot ${id}`);
    return id;
  }

  async loadLatest(): Promise<CanonicalArchitectureGraph | null> {
    const index = await this.readIndex();
    if (index.length === 0) return null;
    return this.loadSnapshot(index[0].id);
  }

  async loadSnapshot(id: string): Promise<CanonicalArchitectureGraph | null> {
    if (this.config.enableCache) {
      const cached = this.cache.get(id);
      if (cached) return cached;
    }

    const snapshotPath = path.join(this.snapshotsDir, `${id}.json`);
    try {
      const raw = await fsp.readFile(snapshotPath, 'utf-8');
      const graph = JSON.parse(raw) as CanonicalArchitectureGraph;
      if (this.config.enableCache) this.cache.set(id, graph);
      return graph;
    } catch {
      return null;
    }
  }

  async loadByCommit(commit: string): Promise<CanonicalArchitectureGraph | null> {
    const index = await this.readIndex();
    // Partial match — useful when commit was stored as the short (7-char) hash
    const meta = index.find(
      m => m.commit === commit || m.commit.startsWith(commit) || commit.startsWith(m.commit),
    );
    if (!meta) return null;
    return this.loadSnapshot(meta.id);
  }

  async listSnapshots(limit = 50): Promise<SnapshotMetadata[]> {
    const index = await this.readIndex();
    return index.slice(0, limit);
  }

  async deleteSnapshot(id: string): Promise<void> {
    // Remove file
    try {
      await fsp.unlink(path.join(this.snapshotsDir, `${id}.json`));
    } catch { /* already gone */ }

    // Remove from cache
    this.cache.delete(id);

    // Remove violations file
    try {
      await fsp.unlink(path.join(this.violationsDir, `${id}.json`));
    } catch { /* no violations file */ }

    // Update index
    const index = await this.readIndex();
    await this.writeJson(
      this.indexFile,
      index.filter(m => m.id !== id),
    );
  }

  async saveViolations(snapshotId: string, violations: Violation[]): Promise<void> {
    const filePath = path.join(this.violationsDir, `${snapshotId}.json`);
    await this.writeJson(filePath, violations);
  }

  async loadViolations(snapshotId: string): Promise<Violation[]> {
    const filePath = path.join(this.violationsDir, `${snapshotId}.json`);
    try {
      const raw = await fsp.readFile(filePath, 'utf-8');
      return JSON.parse(raw) as Violation[];
    } catch {
      return [];
    }
  }

  async savePolicies(policies: PolicyRule[]): Promise<void> {
    await this.writeJson(this.policiesFile, policies);
  }

  async loadPolicies(): Promise<PolicyRule[]> {
    try {
      const raw = await fsp.readFile(this.policiesFile, 'utf-8');
      return JSON.parse(raw) as PolicyRule[];
    } catch {
      return [];
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await fsp.access(this.root);
      return true;
    } catch {
      return false;
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private async readIndex(): Promise<SnapshotMetadata[]> {
    try {
      const raw = await fsp.readFile(this.indexFile, 'utf-8');
      return JSON.parse(raw) as SnapshotMetadata[];
    } catch {
      return [];
    }
  }

  private async writeJson(filePath: string, data: unknown): Promise<void> {
    await fsp.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }
}
