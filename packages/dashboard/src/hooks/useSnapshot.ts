import { useState, useEffect, useCallback } from 'react';
import type { CanonicalArchitectureGraph, Violation } from '@archlens/core';
import { api, type SnapshotMeta } from '../api/client.js';

// ─── Derived metrics ──────────────────────────────────────────────────────────

export interface DashboardMetrics {
  fitnessScore: number;
  layerPurity: number;
  totalModules: number;
  totalEntities: number;
  totalDependencies: number;
  activeViolations: number;
  criticalViolations: number;
  majorViolations: number;
}

function deriveMetrics(graph: CanonicalArchitectureGraph): DashboardMetrics {
  const violations = graph.violations ?? [];

  // Layer purity: fraction of dependencies that don't cross forbidden boundaries
  const forbidden: Record<string, string[]> = {
    ui: ['infrastructure', 'infra'],
    presentation: ['infrastructure', 'infra'],
    controller: ['infrastructure', 'infra'],
  };
  const total = graph.dependencies.length;
  const violating = graph.dependencies.filter(dep => {
    const src = graph.modules.find(m => m.id === dep.sourceId);
    const tgt = graph.modules.find(m => m.id === dep.targetId);
    if (!src || !tgt) return false;
    return forbidden[src.type]?.includes(tgt.type) ?? false;
  }).length;
  const layerPurity = total > 0 ? Math.round((1 - violating / total) * 1000) / 10 : 100;

  // Average module stability → fitness score approximation
  const stabilities = graph.modules
    .filter(m => m.metrics?.stability !== undefined)
    .map(m => m.metrics!.stability!);
  const avgStability = stabilities.length > 0
    ? stabilities.reduce((a, b) => a + b, 0) / stabilities.length
    : 1;

  // Weighted AFS: 25% stability + 20% layerPurity + 55% placeholder
  const fitnessScore = Math.round(
    (0.25 * avgStability * 100 + 0.20 * layerPurity + 0.55 * 85) * 10,
  ) / 10;

  return {
    fitnessScore,
    layerPurity,
    totalModules: graph.modules.length,
    totalEntities: graph.entities.length,
    totalDependencies: graph.dependencies.length,
    activeViolations: violations.length,
    criticalViolations: violations.filter(v => v.severity === 'critical').length,
    majorViolations: violations.filter(v => v.severity === 'major').length,
  };
}

// ─── Hook: latest snapshot ────────────────────────────────────────────────────

export interface UseSnapshotResult {
  graph: CanonicalArchitectureGraph | null;
  metrics: DashboardMetrics | null;
  violations: Violation[];
  snapshots: SnapshotMeta[];
  loading: boolean;
  error: string | null;
  /** Manually re-fetch the latest snapshot. */
  refresh: () => void;
  /** Load a specific snapshot by ID. */
  loadSnapshot: (id: string) => void;
}

const POLL_INTERVAL_MS = 30_000;

export function useSnapshot(): UseSnapshotResult {
  const [graph, setGraph] = useState<CanonicalArchitectureGraph | null>(null);
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLatest = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [latestGraph, snapshotList] = await Promise.all([
        api.getLatestSnapshot(),
        api.listSnapshots(),
      ]);
      setGraph(latestGraph);
      setSnapshots(snapshotList.snapshots);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to load snapshot';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadSnapshot = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const loaded = await api.getSnapshot(id);
      setGraph(loaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load snapshot');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch + polling
  useEffect(() => {
    fetchLatest();
    const timer = setInterval(fetchLatest, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [fetchLatest]);

  const metrics = graph ? deriveMetrics(graph) : null;
  const violations = graph?.violations ?? [];

  return { graph, metrics, violations, snapshots, loading, error, refresh: fetchLatest, loadSnapshot };
}
