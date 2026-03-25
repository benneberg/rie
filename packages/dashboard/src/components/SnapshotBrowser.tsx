import { tokens } from '../styles/design-system.js';
import type { SnapshotMeta } from '../api/client.js';

interface SnapshotBrowserProps {
  snapshots: SnapshotMeta[];
  currentSnapshotId?: string;
  onSelect: (id: string) => void;
  loading: boolean;
}

export function SnapshotBrowser({ snapshots, currentSnapshotId, onSelect, loading }: SnapshotBrowserProps) {
  if (loading && snapshots.length === 0) {
    return (
      <div style={{ padding: tokens.spacing[8], textAlign: 'center', fontFamily: tokens.typography.fontFamily.mono, fontSize: tokens.typography.fontSize.xs, opacity: 0.5 }}>
        Loading snapshots…
      </div>
    );
  }

  if (snapshots.length === 0) {
    return (
      <div style={{ padding: tokens.spacing[8], textAlign: 'center', border: `${tokens.borders.width} solid rgba(0,0,0,0.1)` }}>
        <p style={{ fontFamily: tokens.typography.fontFamily.mono, fontSize: tokens.typography.fontSize.xs, opacity: 0.5, marginBottom: tokens.spacing[3] }}>
          No snapshots yet.
        </p>
        <p style={{ fontFamily: tokens.typography.fontFamily.mono, fontSize: tokens.typography.fontSize.xs, opacity: 0.4 }}>
          Run <code style={{ backgroundColor: 'rgba(0,0,0,0.05)', padding: '0 4px' }}>rie analyze</code> then{' '}
          <code style={{ backgroundColor: 'rgba(0,0,0,0.05)', padding: '0 4px' }}>rie snapshot --create</code> to create one.
        </p>
      </div>
    );
  }

  return (
    <div style={{ border: `${tokens.borders.width} solid rgba(0,0,0,0.1)`, boxShadow: tokens.shadows.brutal }}>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr 120px 60px', gap: tokens.spacing[4], padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`, borderBottom: `2px solid ${tokens.colors.graphite}`, backgroundColor: tokens.colors.graphite, color: tokens.colors.paper, fontFamily: tokens.typography.fontFamily.mono, fontSize: '10px', textTransform: 'uppercase', letterSpacing: tokens.typography.letterSpacing.widest }}>
        <span>ID</span>
        <span>Commit</span>
        <span>Timestamp</span>
        <span>Size</span>
        <span />
      </div>

      {snapshots.map(snap => {
        const isActive = snap.id === currentSnapshotId || snap.commit === currentSnapshotId;
        return (
          <div
            key={snap.id}
            onClick={() => onSelect(snap.id)}
            style={{ display: 'grid', gridTemplateColumns: '1fr 80px 1fr 120px 60px', gap: tokens.spacing[4], padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`, borderBottom: `${tokens.borders.width} solid rgba(0,0,0,0.06)`, cursor: 'pointer', backgroundColor: isActive ? 'rgba(0,235,249,0.06)' : 'transparent', transition: `background-color ${tokens.transitions.fast}`, alignItems: 'center' }}
            onMouseEnter={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.02)'; }}
            onMouseLeave={e => { if (!isActive) e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <span style={{ fontFamily: tokens.typography.fontFamily.mono, fontSize: tokens.typography.fontSize.xs, opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {snap.id.slice(0, 28)}…
            </span>
            <span style={{ fontFamily: tokens.typography.fontFamily.mono, fontSize: tokens.typography.fontSize.xs, color: tokens.colors.cyan }}>
              {snap.commit.slice(0, 7)}
            </span>
            <span style={{ fontFamily: tokens.typography.fontFamily.mono, fontSize: tokens.typography.fontSize.xs, opacity: 0.6 }}>
              {new Date(snap.timestamp).toLocaleString()}
            </span>
            <span style={{ fontFamily: tokens.typography.fontFamily.mono, fontSize: tokens.typography.fontSize.xs, opacity: 0.5 }}>
              {formatBytes(snap.metrics.fileSize)}
            </span>
            <span style={{ fontFamily: tokens.typography.fontFamily.mono, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: isActive ? tokens.colors.cyan : 'rgba(0,0,0,0.3)' }}>
              {isActive ? '● Active' : 'Load'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
