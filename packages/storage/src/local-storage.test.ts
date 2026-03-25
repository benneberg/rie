import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fsp } from 'fs';
import path from 'path';
import os from 'os';
import { LocalStorage } from './local-storage.js';
import type { CanonicalArchitectureGraph } from '@archlens/core';

function makeGraph(overrides: Partial<CanonicalArchitectureGraph> = {}): CanonicalArchitectureGraph {
  const now = new Date().toISOString();
  return {
    version: '2.0.0',
    createdAt: now,
    updatedAt: now,
    metadata: {
      projectName: 'test-project',
      sourceRoot: '/src',
      parserVersion: '1.0.0',
      commit: 'abc1234',
      totalFiles: 10,
      totalEntities: 50,
      totalDependencies: 30,
    },
    modules: [],
    entities: [],
    dependencies: [],
    violations: [],
    ...overrides,
  };
}

describe('LocalStorage', () => {
  let tmpDir: string;
  let storage: LocalStorage;

  beforeEach(async () => {
    tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'archlens-test-'));
    storage = new LocalStorage({ type: 'local', connectionString: tmpDir });
    await storage.initialize();
  });

  afterEach(async () => {
    await storage.close();
    await fsp.rm(tmpDir, { recursive: true, force: true });
  });

  describe('initialize', () => {
    it('creates required directories', async () => {
      const snapshotsDir = path.join(tmpDir, 'snapshots');
      const violationsDir = path.join(tmpDir, 'violations');
      await expect(fsp.access(snapshotsDir)).resolves.toBeUndefined();
      await expect(fsp.access(violationsDir)).resolves.toBeUndefined();
    });

    it('creates an empty index file', async () => {
      const indexFile = path.join(tmpDir, 'index.json');
      const raw = await fsp.readFile(indexFile, 'utf-8');
      expect(JSON.parse(raw)).toEqual([]);
    });
  });

  describe('saveSnapshot / loadSnapshot', () => {
    it('saves and retrieves a graph by ID', async () => {
      const graph = makeGraph();
      const id = await storage.saveSnapshot(graph);
      const loaded = await storage.loadSnapshot(id);
      expect(loaded).toMatchObject({ metadata: { projectName: 'test-project' } });
    });

    it('returns null for an unknown ID', async () => {
      expect(await storage.loadSnapshot('nonexistent')).toBeNull();
    });
  });

  describe('loadLatest', () => {
    it('returns null when no snapshots exist', async () => {
      expect(await storage.loadLatest()).toBeNull();
    });

    it('returns the most recently saved snapshot', async () => {
      await storage.saveSnapshot(makeGraph({ metadata: { ...makeGraph().metadata, projectName: 'first' } }));
      await new Promise(r => setTimeout(r, 5)); // ensure distinct timestamps
      await storage.saveSnapshot(makeGraph({ metadata: { ...makeGraph().metadata, projectName: 'second' } }));

      const latest = await storage.loadLatest();
      expect(latest?.metadata.projectName).toBe('second');
    });
  });

  describe('loadByCommit', () => {
    it('matches by full commit hash', async () => {
      const graph = makeGraph();
      await storage.saveSnapshot(graph);
      const loaded = await storage.loadByCommit('abc1234');
      expect(loaded).not.toBeNull();
    });

    it('matches by short hash prefix', async () => {
      const graph = makeGraph();
      await storage.saveSnapshot(graph);
      const loaded = await storage.loadByCommit('abc');
      expect(loaded).not.toBeNull();
    });

    it('returns null for an unknown commit', async () => {
      expect(await storage.loadByCommit('unknown')).toBeNull();
    });
  });

  describe('listSnapshots', () => {
    it('returns an empty array when no snapshots exist', async () => {
      expect(await storage.listSnapshots()).toEqual([]);
    });

    it('lists snapshots newest first', async () => {
      await storage.saveSnapshot(makeGraph());
      await new Promise(r => setTimeout(r, 5));
      await storage.saveSnapshot(makeGraph());

      const list = await storage.listSnapshots();
      expect(list).toHaveLength(2);
      expect(new Date(list[0].timestamp) >= new Date(list[1].timestamp)).toBe(true);
    });

    it('respects the limit parameter', async () => {
      for (let i = 0; i < 5; i++) {
        await storage.saveSnapshot(makeGraph());
        await new Promise(r => setTimeout(r, 2));
      }
      const list = await storage.listSnapshots(3);
      expect(list).toHaveLength(3);
    });
  });

  describe('deleteSnapshot', () => {
    it('removes the snapshot file and index entry', async () => {
      const id = await storage.saveSnapshot(makeGraph());
      await storage.deleteSnapshot(id);

      expect(await storage.loadSnapshot(id)).toBeNull();
      const list = await storage.listSnapshots();
      expect(list.find(s => s.id === id)).toBeUndefined();
    });
  });

  describe('violations', () => {
    it('saves and loads violations for a snapshot', async () => {
      const id = await storage.saveSnapshot(makeGraph());
      const violations = [
        {
          id: 'v1',
          ruleId: 'layer-ui-to-infra',
          severity: 'critical' as const,
          message: 'Layer violation',
          entityId: 'e1',
          filePath: 'src/ui/A.ts',
          lineNumber: 1,
        },
      ];
      await storage.saveViolations(id, violations);
      const loaded = await storage.loadViolations(id);
      expect(loaded).toHaveLength(1);
      expect(loaded[0].ruleId).toBe('layer-ui-to-infra');
    });

    it('returns empty array when no violations exist', async () => {
      expect(await storage.loadViolations('nonexistent')).toEqual([]);
    });
  });

  describe('policies', () => {
    it('saves and loads policy rules', async () => {
      const policies = [
        { id: 'test-rule', name: 'Test', description: 'Test rule', expression: 'true', severity: 'info' as const, enabled: true },
      ];
      await storage.savePolicies(policies);
      const loaded = await storage.loadPolicies();
      expect(loaded).toHaveLength(1);
      expect(loaded[0].id).toBe('test-rule');
    });

    it('returns empty array when no policies saved', async () => {
      expect(await storage.loadPolicies()).toEqual([]);
    });
  });

  describe('healthCheck', () => {
    it('returns true when storage directory exists', async () => {
      expect(await storage.healthCheck()).toBe(true);
    });
  });
});
