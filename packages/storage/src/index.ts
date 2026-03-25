export type { StorageBackend, StorageConfig, SnapshotMetadata } from './storage.interface.js';
export { ReadCache } from './storage.interface.js';
export { LocalStorage } from './local-storage.js';
export { Neo4jStorage } from './neo4j-storage.js';
export { PostgresStorage } from './postgres-storage.js';

import type { StorageConfig, StorageBackend } from './storage.interface.js';
import { LocalStorage } from './local-storage.js';
import { Neo4jStorage } from './neo4j-storage.js';
import { PostgresStorage } from './postgres-storage.js';

/**
 * Create and initialise a storage backend from a configuration object.
 *
 * Calling `createStorage` is the recommended way to get a backend — it handles
 * both construction and `initialize()` so callers don't have to remember to
 * call init separately.
 *
 * @example
 * // Local filesystem (default for CLI)
 * const storage = await createStorage({
 *   type: 'local',
 *   connectionString: '.archlens/snapshots',
 * });
 *
 * @example
 * // PostgreSQL
 * const storage = await createStorage({
 *   type: 'postgresql',
 *   connectionString: process.env.DATABASE_URL,
 * });
 *
 * @example
 * // Neo4j
 * const storage = await createStorage({
 *   type: 'neo4j',
 *   connectionString: 'neo4j://localhost:7687',
 *   auth: { username: 'neo4j', password: 'password' },
 * });
 */
export async function createStorage(config: StorageConfig): Promise<StorageBackend> {
  let backend: StorageBackend;

  switch (config.type) {
    case 'local':
      backend = new LocalStorage(config);
      break;
    case 'neo4j':
      backend = new Neo4jStorage(config);
      break;
    case 'postgresql':
      backend = new PostgresStorage(config);
      break;
    default: {
      // TypeScript exhaustiveness guard
      const exhaustive: never = config.type;
      throw new Error(`Unsupported storage type: ${exhaustive}`);
    }
  }

  await backend.initialize();
  return backend;
}

/**
 * Create a storage backend from environment variables.
 * Useful for the GitHub App server and other long-running processes.
 *
 * Environment variables:
 *   ARCHLENS_STORAGE_TYPE          — 'local' | 'neo4j' | 'postgresql' (default: 'local')
 *   ARCHLENS_STORAGE_URL           — connection string / directory path
 *   ARCHLENS_STORAGE_USERNAME      — (neo4j / postgresql)
 *   ARCHLENS_STORAGE_PASSWORD      — (neo4j / postgresql)
 *   ARCHLENS_STORAGE_CACHE         — 'true' | 'false' (default: 'true')
 *   ARCHLENS_STORAGE_CACHE_TTL     — seconds (default: 300)
 */
export async function createStorageFromEnv(): Promise<StorageBackend> {
  const type = (process.env.ARCHLENS_STORAGE_TYPE ?? 'local') as StorageConfig['type'];
  const connectionString = process.env.ARCHLENS_STORAGE_URL ?? '.archlens/snapshots';
  const username = process.env.ARCHLENS_STORAGE_USERNAME;
  const password = process.env.ARCHLENS_STORAGE_PASSWORD;
  const enableCache = process.env.ARCHLENS_STORAGE_CACHE !== 'false';
  const cacheTtl = parseInt(process.env.ARCHLENS_STORAGE_CACHE_TTL ?? '300', 10);

  const config: StorageConfig = {
    type,
    connectionString,
    enableCache,
    cacheTtl: isNaN(cacheTtl) ? 300 : cacheTtl,
    ...(username && password ? { auth: { username, password } } : {}),
  };

  return createStorage(config);
}
