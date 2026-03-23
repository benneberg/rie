// packages/shared/src/types.ts

export type Layer = 'ui' | 'application' | 'domain' | 'infrastructure';

export interface CAGNode {
  id: string;
  type: 'module' | 'class' | 'function';
  layer: Layer;
  stability: number; // 0 to 1
  complexity: number;
  filePath: string;
}

export interface CAGEdge {
  source: string;
  target: string;
  relation: 'imports' | 'calls' | 'inherits';
  isAsync: boolean;
  weight: number;
}

export interface ArchitectureSnapshot {
  version: "2.0.0";
  metadata: {
    commit: string;
    timestamp: string;
  };
  nodes: CAGNode[];
  edges: CAGEdge[];
}
