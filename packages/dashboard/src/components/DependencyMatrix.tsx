import { useRef, useEffect } from 'react';
import { tokens } from '../styles/design-system.js';
import type { CanonicalArchitectureGraph } from '@archlens/core';

interface DependencyMatrixProps {
  graph: CanonicalArchitectureGraph | null;
}

/**
 * N×N adjacency matrix rendered on a Canvas element.
 * Rows = source module, columns = target module.
 * Cell colour intensity = dependency weight (or 1 if weight absent).
 * Layer-violation cells are rendered in alert red.
 */
export function DependencyMatrix({ graph }: DependencyMatrixProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const modules = graph?.modules ?? [];
  const deps = graph?.dependencies ?? [];

  // Forbidden layer pairs for violation highlighting
  const forbidden: Record<string, string[]> = {
    ui: ['infrastructure', 'infra'],
    presentation: ['infrastructure', 'infra'],
    controller: ['infrastructure', 'infra'],
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || modules.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const N = modules.length;
    // Cap label area and cell size so the matrix stays readable
    const LABEL_W = Math.min(100, Math.max(60, 120 - N * 2));
    const CELL = Math.max(12, Math.min(32, Math.floor((560 - LABEL_W) / N)));
    const GRID_W = N * CELL;
    const GRID_H = N * CELL;
    const CANVAS_W = LABEL_W + GRID_W;
    const CANVAS_H = LABEL_W + GRID_H;

    const dpr = window.devicePixelRatio ?? 1;
    canvas.width = CANVAS_W * dpr;
    canvas.height = CANVAS_H * dpr;
    canvas.style.width = `${CANVAS_W}px`;
    canvas.style.height = `${CANVAS_H}px`;
    ctx.scale(dpr, dpr);

    // Background
    ctx.fillStyle = tokens.colors.paper;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Build weight map: sourceIdx → targetIdx → weight
    const idToIdx = new Map(modules.map((m, i) => [m.id, i]));
    const weights = Array.from({ length: N }, () => new Array<number>(N).fill(0));
    for (const dep of deps) {
      const si = idToIdx.get(dep.sourceId);
      const ti = idToIdx.get(dep.targetId);
      if (si !== undefined && ti !== undefined) {
        weights[si][ti] = (dep.weight ?? 0) > 0 ? dep.weight! : 1;
      }
    }

    // Cells
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const x = LABEL_W + c * CELL;
        const y = LABEL_W + r * CELL;
        const w = weights[r][c];

        // Checkerboard empty background
        const bg = (r + c) % 2 === 0 ? 'rgba(0,0,0,0.02)' : tokens.colors.paper;
        ctx.fillStyle = bg;
        ctx.fillRect(x, y, CELL, CELL);

        if (w > 0) {
          const srcMod = modules[r];
          const tgtMod = modules[c];
          const isViolation = forbidden[srcMod.type]?.includes(tgtMod.type) ?? false;

          if (isViolation) {
            ctx.fillStyle = `rgba(255,59,48,${Math.min(w / 15 + 0.4, 0.9)})`;
          } else {
            const alpha = Math.min(w / 15 + 0.2, 0.85);
            ctx.fillStyle = `rgba(0,235,249,${alpha})`;
          }
          ctx.fillRect(x + 1, y + 1, CELL - 2, CELL - 2);
        }
      }
    }

    // Grid lines
    ctx.strokeStyle = 'rgba(0,0,0,0.06)';
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= N; i++) {
      ctx.beginPath();
      ctx.moveTo(LABEL_W + i * CELL, LABEL_W);
      ctx.lineTo(LABEL_W + i * CELL, LABEL_W + GRID_H);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(LABEL_W, LABEL_W + i * CELL);
      ctx.lineTo(LABEL_W + GRID_W, LABEL_W + i * CELL);
      ctx.stroke();
    }

    const FONT_SIZE = Math.max(8, Math.min(11, CELL - 2));
    ctx.font = `500 ${FONT_SIZE}px "Space Grotesk", sans-serif`;
    ctx.fillStyle = 'rgba(0,0,0,0.55)';

    // Column labels (rotated)
    for (let c = 0; c < N; c++) {
      const label = modules[c].name.length > 10 ? modules[c].name.slice(0, 9) + '…' : modules[c].name;
      ctx.save();
      ctx.translate(LABEL_W + c * CELL + CELL / 2, LABEL_W - 4);
      ctx.rotate(-Math.PI / 3);
      ctx.textAlign = 'left';
      ctx.fillText(label, 0, 0);
      ctx.restore();
    }

    // Row labels
    ctx.textAlign = 'right';
    for (let r = 0; r < N; r++) {
      const label = modules[r].name.length > 12 ? modules[r].name.slice(0, 11) + '…' : modules[r].name;
      ctx.fillText(label, LABEL_W - 4, LABEL_W + r * CELL + CELL / 2 + FONT_SIZE / 3);
    }
  }, [modules, deps]);

  if (modules.length === 0) {
    return (
      <div style={{
        border: `${tokens.borders.width} solid rgba(0,0,0,0.1)`,
        padding: tokens.spacing[8],
        textAlign: 'center',
        fontFamily: tokens.typography.fontFamily.mono,
        fontSize: tokens.typography.fontSize.xs,
        opacity: 0.5,
      }}>
        No modules in current snapshot — run <code>rie analyze</code> first.
      </div>
    );
  }

  return (
    <div style={{
      border: `${tokens.borders.width} solid rgba(0,0,0,0.1)`,
      boxShadow: tokens.shadows.brutal,
      backgroundColor: tokens.colors.paper,
      overflow: 'auto',
    }}>
      <canvas ref={canvasRef} style={{ display: 'block' }} />
      <div style={{
        padding: `${tokens.spacing[2]} ${tokens.spacing[4]}`,
        borderTop: `${tokens.borders.width} solid rgba(0,0,0,0.08)`,
        display: 'flex',
        gap: tokens.spacing[6],
        fontFamily: tokens.typography.fontFamily.mono,
        fontSize: '10px',
        opacity: 0.6,
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, backgroundColor: 'rgba(0,235,249,0.6)', display: 'inline-block' }} />
          Dependency
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 10, height: 10, backgroundColor: 'rgba(255,59,48,0.7)', display: 'inline-block' }} />
          Layer violation
        </span>
        <span style={{ marginLeft: 'auto' }}>{modules.length}×{modules.length} · {deps.length} edges</span>
      </div>
    </div>
  );
}
