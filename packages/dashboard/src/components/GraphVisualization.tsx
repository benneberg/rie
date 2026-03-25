import { useEffect, useRef } from 'react';
import { tokens } from '../styles/design-system.js';
import type { CanonicalArchitectureGraph } from '@archlens/core';

interface GraphVisualizationProps {
  graph: CanonicalArchitectureGraph | null;
}

interface DrawNode { id: string; label: string; type: string; x: number; y: number }
interface DrawEdge { source: string; target: string; weight: number }

const typeColors: Record<string, string> = {
  ui: '#00ebf9',
  domain: '#050505',
  infrastructure: '#ff3b30',
  service: '#ff9500',
  module: '#c6c6c6',
  component: '#007aff',
  repository: '#34c759',
  controller: '#ff9500',
  layer: '#5e5e5e',
  infra: '#ff3b30',
  presentation: '#00ebf9',
};

const DEFAULT_COLOR = '#c6c6c6';

/**
 * Canvas-based graph visualisation.
 * When a real graph is provided, modules are laid out in a simple force-directed
 * circle. Falls back to static sample data when no graph is available.
 */
export function GraphVisualization({ graph }: GraphVisualizationProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { nodes, edges } = buildDrawData(graph);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio ?? 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const W = rect.width;
    const H = rect.height;

    // Background
    ctx.fillStyle = tokens.colors.paper;
    ctx.fillRect(0, 0, W, H);

    // Dot-grid
    ctx.fillStyle = 'rgba(0,0,0,0.04)';
    for (let gx = 0; gx < W; gx += 32) {
      for (let gy = 0; gy < H; gy += 32) {
        ctx.beginPath();
        ctx.arc(gx, gy, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Normalise node positions to canvas space
    const scaledNodes = scaleNodes(nodes, W, H);

    // Edges
    for (const edge of edges) {
      const src = scaledNodes.find(n => n.id === edge.source);
      const tgt = scaledNodes.find(n => n.id === edge.target);
      if (!src || !tgt) continue;
      const opacity = Math.min(edge.weight / 15, 0.8);
      ctx.strokeStyle = `rgba(0,0,0,${opacity * 0.5})`;
      ctx.lineWidth = Math.max(edge.weight / 5, 0.5);
      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);
      ctx.stroke();
    }

    // Nodes
    for (const node of scaledNodes) {
      const color = typeColors[node.type] ?? DEFAULT_COLOR;
      const r = node.type === 'domain' || node.type === 'module' ? 22 : 18;

      // Glow for primary nodes
      if (node.type === 'domain' || node.type === 'ui') {
        const grd = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, r * 2.5);
        grd.addColorStop(0, `${color}30`);
        grd.addColorStop(1, 'transparent');
        ctx.fillStyle = grd;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r * 2.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Node fill
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fill();

      // Border
      ctx.strokeStyle = tokens.colors.paper;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      const isDark = color === '#050505' || color === '#5e5e5e';
      ctx.fillStyle = isDark ? tokens.colors.paper : tokens.colors.void;
      ctx.font = `500 10px "Space Grotesk", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      // Truncate long labels
      const label = node.label.length > 12 ? node.label.slice(0, 11) + '…' : node.label;
      ctx.fillText(label, node.x, node.y + r + 5);
    }
  }, [nodes, edges]);

  return (
    <div style={{ border: `${tokens.borders.width} solid rgba(0,0,0,0.1)`, boxShadow: tokens.shadows.brutal, backgroundColor: tokens.colors.paper, overflow: 'hidden' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '420px', display: 'block' }} />

      {/* Legend */}
      <div style={{ padding: tokens.spacing[3], borderTop: `${tokens.borders.width} solid rgba(0,0,0,0.08)`, display: 'flex', gap: tokens.spacing[4], flexWrap: 'wrap', fontFamily: tokens.typography.fontFamily.mono, fontSize: '10px' }}>
        {Object.entries(typeColors).slice(0, 6).map(([type, color]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[1] }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: color, display: 'inline-block', border: '1px solid rgba(0,0,0,0.1)' }} />
            <span style={{ opacity: 0.6, textTransform: 'capitalize' }}>{type}</span>
          </div>
        ))}
        {graph && (
          <span style={{ marginLeft: 'auto', opacity: 0.4 }}>
            {graph.modules.length} modules · {graph.dependencies.length} edges
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildDrawData(graph: CanonicalArchitectureGraph | null): { nodes: DrawNode[]; edges: DrawEdge[] } {
  if (!graph || graph.modules.length === 0) return { nodes: SAMPLE_NODES, edges: SAMPLE_EDGES };

  // Circle layout — modules arranged evenly on a unit circle
  const n = graph.modules.length;
  const nodes: DrawNode[] = graph.modules.map((mod, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2;
    return { id: mod.id, label: mod.name, type: mod.type, x: Math.cos(angle), y: Math.sin(angle) };
  });

  const edges: DrawEdge[] = graph.dependencies.map(dep => ({
    source: dep.sourceId,
    target: dep.targetId,
    weight: typeof dep.weight === 'number' ? dep.weight * 15 : 6,
  }));

  return { nodes, edges };
}

function scaleNodes(nodes: DrawNode[], W: number, H: number): DrawNode[] {
  if (nodes.length === 0) return [];
  const padding = 60;
  const xs = nodes.map(n => n.x);
  const ys = nodes.map(n => n.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;

  return nodes.map(n => ({
    ...n,
    x: padding + ((n.x - minX) / rangeX) * (W - padding * 2),
    y: padding + ((n.y - minY) / rangeY) * (H - padding * 2),
  }));
}

// Static fallback shown when no snapshot is loaded
const SAMPLE_NODES: DrawNode[] = [
  { id: 'ui:checkout', label: 'Checkout', type: 'ui', x: 0.1, y: -0.6 },
  { id: 'ui:products', label: 'Products', type: 'ui', x: 0.6, y: -0.6 },
  { id: 'core:payment', label: 'Payment', type: 'domain', x: -0.2, y: 0 },
  { id: 'core:orders', label: 'Orders', type: 'domain', x: 0.5, y: 0 },
  { id: 'infra:db', label: 'Database', type: 'infrastructure', x: 0.1, y: 0.7 },
  { id: 'infra:cache', label: 'Cache', type: 'infrastructure', x: 0.7, y: 0.5 },
  { id: 'service:auth', label: 'Auth', type: 'service', x: 1.0, y: -0.1 },
];
const SAMPLE_EDGES: DrawEdge[] = [
  { source: 'ui:checkout', target: 'core:payment', weight: 10 },
  { source: 'ui:products', target: 'core:orders', weight: 7 },
  { source: 'core:payment', target: 'infra:db', weight: 12 },
  { source: 'core:orders', target: 'infra:db', weight: 9 },
  { source: 'core:payment', target: 'infra:cache', weight: 5 },
  { source: 'ui:checkout', target: 'service:auth', weight: 4 },
];
