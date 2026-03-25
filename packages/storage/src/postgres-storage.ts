import type { CanonicalArchitectureGraph, Violation, PolicyRule } from '@archlens/core';
import type { StorageBackend, StorageConfig, SnapshotMetadata } from './storage.interface.js';
import { ReadCache } from './storage.interface.js';

// pg is imported dynamically so the package builds in environments that do not
// have Postgres installed (tests, Neo4j-only deployments, etc.).
type PgPool = {
  query<T = unknown>(sql: string, values?: unknown[]): Promise<{ rows: T[] }>;
  end(): Promise<void>;
};

/**
 * PostgreSQL storage backend.
 *
 * Schema (auto-created on first initialize()):
 *
 *   snapshots   (id TEXT PK, commit TEXT, timestamp TIMESTAMPTZ, file_size INT, data JSONB)
 *   violations  (id SERIAL PK, snapshot_id TEXT FK, data JSONB)
 *   policies    (id TEXT PK, data JSONB)      — single row "global"
 */
export class PostgresStorage implements StorageBackend {
  private config: StorageConfig;
  private pool: PgPool | null = null;
  private cache: ReadCache<CanonicalArchitectureGraph>;

  constructor(config: StorageConfig) {
    if (config.type !== 'postgresql') {
      throw new Error('PostgresStorage requires type "postgresql"');
    }
    this.config = { enableCache: true, cacheTtl: 300, ...config };
    this.cache = new ReadCache<CanonicalArchitectureGraph>(this.config.cacheTtl ?? 300);
  }

  async initialize(): Promise<void> {
    const { default: pg } = await import('pg') as { default: { Pool: new (o: object) => PgPool } };

    this.pool = new pg.Pool({ connectionString: this.config.connectionString });

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS snapshots (
        id          TEXT PRIMARY KEY,
        commit      TEXT NOT NULL,
        timestamp   TIMESTAMPTZ NOT NULL,
        file_size   INTEGER NOT NULL DEFAULT 0,
        data        JSONB NOT NULL
      );

      CREATE INDEX IF NOT EXISTS snapshots_commit_idx    ON snapshots (commit);
      CREATE INDEX IF NOT EXISTS snapshots_timestamp_idx ON snapshots (timestamp DESC);

      CREATE TABLE IF NOT EXISTS violations (
        id          SERIAL PRIMARY KEY,
        snapshot_id TEXT NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
        data        JSONB NOT NULL
      );

      CREATE INDEX IF NOT EXISTS violations_snapshot_idx ON violations (snapshot_id);

      CREATE TABLE IF NOT EXISTS policies (
        id   TEXT PRIMARY KEY,
        data JSONB NOT NULL
      );
    `);

    console.log(`PostgresStorage: connected to ${this.config.connectionString}`);
  }

  async close(): Promise<void> {
    this.cache.clear();
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
  }

  async saveSnapshot(graph: CanonicalArchitectureGraph): Promise<string> {
    this.assertConnected();
    const commit = graph.metadata.commit ?? 'local';
    const id = `snapshot-${Date.now()}-${commit.slice(0, 7)}`;
    const serialised = JSON.stringify(graph);

    await this.pool!.query(
      `INSERT INTO snapshots (id, commit, timestamp, file_size, data)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, commit, graph.createdAt, Buffer.byteLength(serialised), graph],
    );

    if (this.config.enableCache) this.cache.set(id, graph);
    console.log(`PostgresStorage: saved snapshot ${id}`);
    return id;
  }

  async loadLatest(): Promise<CanonicalArchitectureGraph | null> {
    this.assertConnected();
    const { rows } = await this.pool!.query<{ data: CanonicalArchitectureGraph }>(
      'SELECT data FROM snapshots ORDER BY timestamp DESC LIMIT 1',
    );
    return rows[0]?.data ?? null;
  }

  async loadSnapshot(id: string): Promise<CanonicalArchitectureGraph | null> {
    this.assertConnected();
    if (this.config.enableCache) {
      const cached = this.cache.get(id);
      if (cached) return cached;
    }

    const { rows } = await this.pool!.query<{ data: CanonicalArchitectureGraph }>(
      'SELECT data FROM snapshots WHERE id = $1',
      [id],
    );
    const graph = rows[0]?.data ?? null;
    if (graph && this.config.enableCache) this.cache.set(id, graph);
    return graph;
  }

  async loadByCommit(commit: string): Promise<CanonicalArchitectureGraph | null> {
    this.assertConnected();
    // Support both full and 7-char short hashes
    const { rows } = await this.pool!.query<{ data: CanonicalArchitectureGraph }>(
      `SELECT data FROM snapshots
       WHERE commit = $1 OR commit LIKE $2 OR $1 LIKE commit || '%'
       ORDER BY timestamp DESC LIMIT 1`,
      [commit, `${commit}%`],
    );
    return rows[0]?.data ?? null;
  }

  async listSnapshots(limit = 50): Promise<SnapshotMetadata[]> {
    this.assertConnected();
    const { rows } = await this.pool!.query<{
      id: string;
      commit: string;
      timestamp: string;
      file_size: number;
    }>(
      'SELECT id, commit, timestamp, file_size FROM snapshots ORDER BY timestamp DESC LIMIT $1',
      [limit],
    );

    return rows.map(r => ({
      id: r.id,
      commit: r.commit,
      timestamp: r.timestamp,
      metrics: {
        totalModules: 0,
        totalEntities: 0,
        totalDependencies: 0,
        fileSize: r.file_size,
      },
    }));
  }

  async deleteSnapshot(id: string): Promise<void> {
    this.assertConnected();
    // Cascades to violations via FK constraint
    await this.pool!.query('DELETE FROM snapshots WHERE id = $1', [id]);
    this.cache.delete(id);
  }

  async saveViolations(snapshotId: string, violations: Violation[]): Promise<void> {
    this.assertConnected();
    // Replace all violations for this snapshot atomically
    await this.pool!.query('DELETE FROM violations WHERE snapshot_id = $1', [snapshotId]);

    if (violations.length === 0) return;

    // Batch insert
    const placeholders = violations
      .map((_, i) => `($${i * 2 + 1}, $${i * 2 + 2})`)
      .join(', ');
    const values = violations.flatMap(v => [snapshotId, JSON.stringify(v)]);

    await this.pool!.query(
      `INSERT INTO violations (snapshot_id, data) VALUES ${placeholders}`,
      values,
    );
  }

  async loadViolations(snapshotId: string): Promise<Violation[]> {
    this.assertConnected();
    const { rows } = await this.pool!.query<{ data: Violation }>(
      'SELECT data FROM violations WHERE snapshot_id = $1',
      [snapshotId],
    );
    return rows.map(r => r.data);
  }

  async savePolicies(policies: PolicyRule[]): Promise<void> {
    this.assertConnected();
    await this.pool!.query(
      `INSERT INTO policies (id, data) VALUES ('global', $1)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
      [JSON.stringify(policies)],
    );
  }

  async loadPolicies(): Promise<PolicyRule[]> {
    this.assertConnected();
    const { rows } = await this.pool!.query<{ data: PolicyRule[] }>(
      "SELECT data FROM policies WHERE id = 'global'",
    );
    return rows[0]?.data ?? [];
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.pool!.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  private assertConnected(): void {
    if (!this.pool) {
      throw new Error('PostgresStorage: not initialised — call initialize() first');
    }
  }
}
