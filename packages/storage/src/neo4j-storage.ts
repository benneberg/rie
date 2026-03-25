import type { CanonicalArchitectureGraph, Violation, PolicyRule } from '@archlens/core';
import type { StorageBackend, StorageConfig, SnapshotMetadata } from './storage.interface.js';
import { ReadCache } from './storage.interface.js';

// neo4j-driver is imported dynamically so the package still builds (and tests
// still run) in environments where Neo4j is not installed.
type Neo4jDriver = {
  session(): Neo4jSession;
  close(): Promise<void>;
};
type Neo4jSession = {
  run(query: string, params?: Record<string, unknown>): Promise<{ records: Neo4jRecord[] }>;
  close(): Promise<void>;
};
type Neo4jRecord = {
  get(key: string): unknown;
};

/**
 * Neo4j storage backend.
 *
 * Schema (Cypher nodes / relationships):
 *
 *   (:Snapshot { id, commit, timestamp, data, fileSize })
 *   (:Violation { ... })  -[:BELONGS_TO]-> (:Snapshot)
 *   (:PolicyConfig { data })   — single node, upserted on write
 *
 * The full CAG is stored as a JSON string in `data` for simplicity.
 * A future migration can explode entities/dependencies into proper graph nodes
 * when traversal queries are needed.
 */
export class Neo4jStorage implements StorageBackend {
  private config: StorageConfig;
  private driver: Neo4jDriver | null = null;
  private cache: ReadCache<CanonicalArchitectureGraph>;

  constructor(config: StorageConfig) {
    if (config.type !== 'neo4j') {
      throw new Error('Neo4jStorage requires type "neo4j"');
    }
    this.config = { enableCache: true, cacheTtl: 300, ...config };
    this.cache = new ReadCache<CanonicalArchitectureGraph>(this.config.cacheTtl ?? 300);
  }

  async initialize(): Promise<void> {
    const neo4j = await import('neo4j-driver');
    const auth = this.config.auth
      ? neo4j.default.auth.basic(this.config.auth.username, this.config.auth.password)
      : neo4j.default.auth.basic('neo4j', 'neo4j');

    this.driver = neo4j.default.driver(this.config.connectionString, auth) as unknown as Neo4jDriver;

    // Create constraints / indexes — idempotent
    await this.run(`
      CREATE CONSTRAINT snapshot_id IF NOT EXISTS
      FOR (s:Snapshot) REQUIRE s.id IS UNIQUE
    `);
    await this.run(`
      CREATE INDEX snapshot_commit IF NOT EXISTS
      FOR (s:Snapshot) ON (s.commit)
    `);
    await this.run(`
      CREATE INDEX snapshot_timestamp IF NOT EXISTS
      FOR (s:Snapshot) ON (s.timestamp)
    `);

    console.log(`Neo4jStorage: connected to ${this.config.connectionString}`);
  }

  async close(): Promise<void> {
    this.cache.clear();
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
    }
  }

  async saveSnapshot(graph: CanonicalArchitectureGraph): Promise<string> {
    this.assertConnected();
    const commit = graph.metadata.commit ?? 'local';
    const id = `snapshot-${Date.now()}-${commit.slice(0, 7)}`;
    const data = JSON.stringify(graph);

    await this.run(
      `CREATE (s:Snapshot {
        id: $id,
        commit: $commit,
        timestamp: $timestamp,
        fileSize: $fileSize,
        data: $data
      })`,
      { id, commit, timestamp: graph.createdAt, fileSize: Buffer.byteLength(data), data },
    );

    if (this.config.enableCache) this.cache.set(id, graph);
    console.log(`Neo4jStorage: saved snapshot ${id}`);
    return id;
  }

  async loadLatest(): Promise<CanonicalArchitectureGraph | null> {
    this.assertConnected();
    const result = await this.run(
      'MATCH (s:Snapshot) RETURN s.data AS data ORDER BY s.timestamp DESC LIMIT 1',
    );
    return this.parseGraphRecord(result.records[0]);
  }

  async loadSnapshot(id: string): Promise<CanonicalArchitectureGraph | null> {
    this.assertConnected();
    if (this.config.enableCache) {
      const cached = this.cache.get(id);
      if (cached) return cached;
    }

    const result = await this.run(
      'MATCH (s:Snapshot {id: $id}) RETURN s.data AS data',
      { id },
    );
    const graph = this.parseGraphRecord(result.records[0]);
    if (graph && this.config.enableCache) this.cache.set(id, graph);
    return graph;
  }

  async loadByCommit(commit: string): Promise<CanonicalArchitectureGraph | null> {
    this.assertConnected();
    // STARTS WITH for short-hash matching
    const result = await this.run(
      'MATCH (s:Snapshot) WHERE s.commit STARTS WITH $commit OR $commit STARTS WITH s.commit RETURN s.data AS data ORDER BY s.timestamp DESC LIMIT 1',
      { commit },
    );
    return this.parseGraphRecord(result.records[0]);
  }

  async listSnapshots(limit = 50): Promise<SnapshotMetadata[]> {
    this.assertConnected();
    const result = await this.run(
      `MATCH (s:Snapshot)
       RETURN s.id AS id, s.commit AS commit, s.timestamp AS timestamp, s.fileSize AS fileSize
       ORDER BY s.timestamp DESC LIMIT $limit`,
      { limit },
    );

    return result.records.map(r => ({
      id: r.get('id') as string,
      commit: r.get('commit') as string,
      timestamp: r.get('timestamp') as string,
      metrics: {
        totalModules: 0,
        totalEntities: 0,
        totalDependencies: 0,
        fileSize: (r.get('fileSize') as number) ?? 0,
      },
    }));
  }

  async deleteSnapshot(id: string): Promise<void> {
    this.assertConnected();
    await this.run('MATCH (s:Snapshot {id: $id}) DETACH DELETE s', { id });
    this.cache.delete(id);
  }

  async saveViolations(snapshotId: string, violations: Violation[]): Promise<void> {
    this.assertConnected();
    // Upsert violations as a JSON blob on the snapshot node (simpler than
    // individual Violation nodes for the current query patterns)
    await this.run(
      'MATCH (s:Snapshot {id: $id}) SET s.violations = $violations',
      { id: snapshotId, violations: JSON.stringify(violations) },
    );
  }

  async loadViolations(snapshotId: string): Promise<Violation[]> {
    this.assertConnected();
    const result = await this.run(
      'MATCH (s:Snapshot {id: $id}) RETURN s.violations AS violations',
      { id: snapshotId },
    );
    if (!result.records[0]) return [];
    const raw = result.records[0].get('violations') as string | null;
    if (!raw) return [];
    return JSON.parse(raw) as Violation[];
  }

  async savePolicies(policies: PolicyRule[]): Promise<void> {
    this.assertConnected();
    await this.run(
      `MERGE (p:PolicyConfig {id: "global"})
       SET p.data = $data`,
      { data: JSON.stringify(policies) },
    );
  }

  async loadPolicies(): Promise<PolicyRule[]> {
    this.assertConnected();
    const result = await this.run(
      'MATCH (p:PolicyConfig {id: "global"}) RETURN p.data AS data',
    );
    if (!result.records[0]) return [];
    const raw = result.records[0].get('data') as string | null;
    return raw ? (JSON.parse(raw) as PolicyRule[]) : [];
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.run('RETURN 1');
      return true;
    } catch {
      return false;
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async run(
    query: string,
    params: Record<string, unknown> = {},
  ): Promise<{ records: Neo4jRecord[] }> {
    if (!this.driver) throw new Error('Neo4jStorage: not initialised — call initialize() first');
    const session = this.driver.session();
    try {
      return await session.run(query, params);
    } finally {
      await session.close();
    }
  }

  private parseGraphRecord(record: Neo4jRecord | undefined): CanonicalArchitectureGraph | null {
    if (!record) return null;
    const raw = record.get('data') as string | null;
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CanonicalArchitectureGraph;
    } catch {
      console.error('Neo4jStorage: failed to parse snapshot data');
      return null;
    }
  }

  private assertConnected(): void {
    if (!this.driver) throw new Error('Neo4jStorage: not initialised — call initialize() first');
  }
}
