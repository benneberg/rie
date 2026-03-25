import type { CanonicalArchitectureGraph, Violation, PolicyRule } from '@archlens/core';

// ─── Configuration ────────────────────────────────────────────────────────────

export interface StorageConfig {
  /** Storage backend type */
  type: 'neo4j' | 'postgresql' | 'local';
  /**
   * Connection URI (neo4j/postgresql) or directory path (local).
   * Examples:
   *   neo4j:     'neo4j://localhost:7687'
   *   postgresql: 'postgresql://user:pass@localhost:5432/archlens'
   *   local:      '/path/to/.archlens/snapshots'
   */
  connectionString: string;
  /** Credentials — used by neo4j and postgresql backends */
  auth?: { username: string; password: string };
  /** Enable in-memory read cache */
  enableCache?: boolean;
  /** Cache TTL in seconds (default: 300) */
  cacheTtl?: number;
}

// ─── Snapshot metadata ────────────────────────────────────────────────────────

export interface SnapshotMetadata {
  id: string;
  commit: string;
  timestamp: string;
  message?: string;
  metrics: {
    totalModules: number;
    totalEntities: number;
    totalDependencies: number;
    /** Serialised byte size of the snapshot */
    fileSize: number;
  };
}

// ─── Backend interface ────────────────────────────────────────────────────────

export interface StorageBackend {
  initialize(): Promise<void>;
  close(): Promise<void>;

  /** Persist an architecture graph and return its snapshot ID. */
  saveSnapshot(graph: CanonicalArchitectureGraph): Promise<string>;

  /** Return the most recently saved snapshot, or null if none exist. */
  loadLatest(): Promise<CanonicalArchitectureGraph | null>;

  /** Load a snapshot by its ID. */
  loadSnapshot(id: string): Promise<CanonicalArchitectureGraph | null>;

  /** Load the snapshot recorded for a specific commit hash. */
  loadByCommit(commit: string): Promise<CanonicalArchitectureGraph | null>;

  /** List snapshot metadata, newest first. */
  listSnapshots(limit?: number): Promise<SnapshotMetadata[]>;

  deleteSnapshot(id: string): Promise<void>;

  saveViolations(snapshotId: string, violations: Violation[]): Promise<void>;
  loadViolations(snapshotId: string): Promise<Violation[]>;

  savePolicies(policies: PolicyRule[]): Promise<void>;
  loadPolicies(): Promise<PolicyRule[]>;

  healthCheck(): Promise<boolean>;
}

// ─── Shared cache helper ──────────────────────────────────────────────────────

export interface CacheEntry<T> {
  data: T;
  expiry: number;
}

export class ReadCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private ttlMs: number;

  constructor(ttlSeconds = 300) {
    this.ttlMs = ttlSeconds * 1000;
  }

  get(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiry < Date.now()) {
      this.store.delete(key);
      return null;
    }
    return entry.data;
  }

  set(key: string, data: T): void {
    this.store.set(key, { data, expiry: Date.now() + this.ttlMs });
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}
