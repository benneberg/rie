/**
 * API client for the ArchLens RIE GitHub App server.
 *
 * Base URL is read from VITE_API_URL at build time (defaults to same origin,
 * which works when the dashboard is served by the GitHub App express server or
 * proxied by Vite in dev mode).
 */
import type { CanonicalArchitectureGraph } from '@archlens/core';

const BASE_URL = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL ?? '';

export interface SnapshotMeta {
  id: string;
  commit: string;
  timestamp: string;
  metrics: {
    totalModules: number;
    totalEntities: number;
    totalDependencies: number;
    fileSize: number;
  };
}

async function request<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw Object.assign(new Error(body.error ?? res.statusText), { status: res.status });
  }
  return res.json() as Promise<T>;
}

export const api = {
  getLatestSnapshot(): Promise<CanonicalArchitectureGraph> {
    return request<CanonicalArchitectureGraph>('/api/snapshots/latest');
  },
  getSnapshot(id: string): Promise<CanonicalArchitectureGraph> {
    return request<CanonicalArchitectureGraph>(`/api/snapshots/${id}`);
  },
  listSnapshots(): Promise<{ snapshots: SnapshotMeta[] }> {
    return request<{ snapshots: SnapshotMeta[] }>('/api/snapshots');
  },
  getHealth(): Promise<{ status: string; timestamp: string }> {
    return request('/health');
  },
};
