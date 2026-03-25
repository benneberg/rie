import { tokens } from '../styles/design-system.js';

interface NavigationProps {
  onRefresh: () => void;
  loading: boolean;
}

export function Navigation({ onRefresh, loading }: NavigationProps) {
  return (
    <nav style={{ position: 'sticky', top: 0, zIndex: tokens.zIndex.sticky, backgroundColor: `${tokens.colors.paper}e6`, backdropFilter: 'blur(8px)', borderBottom: `${tokens.borders.width} solid rgba(0,0,0,0.1)` }}>
      <div style={{ maxWidth: '1800px', margin: '0 auto', padding: `${tokens.spacing[4]} ${tokens.spacing[6]}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[4] }}>
          <span style={{ fontFamily: tokens.typography.fontFamily.mono, fontSize: '1.5rem' }}>◧</span>
          <span style={{ fontFamily: tokens.typography.fontFamily.display, fontSize: tokens.typography.fontSize.lg, fontWeight: tokens.typography.fontWeight.black, letterSpacing: tokens.typography.letterSpacing.wider }}>
            ARCHLENS<span style={{ color: tokens.colors.cyan }}>.</span>RIE
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[6] }}>
          {/* Live indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: tokens.spacing[2], fontFamily: tokens.typography.fontFamily.mono, fontSize: tokens.typography.fontSize.xs, opacity: 0.5 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: loading ? tokens.colors.amber : tokens.colors.cyan, transition: `background-color ${tokens.transitions.normal}`, animation: 'pulse 2s ease-in-out infinite' }} />
            <span>{loading ? 'Syncing…' : 'Live'}</span>
          </div>

          {/* Refresh button */}
          <button
            onClick={onRefresh}
            disabled={loading}
            style={{ padding: `${tokens.spacing[2]} ${tokens.spacing[4]}`, fontFamily: tokens.typography.fontFamily.mono, fontSize: tokens.typography.fontSize.xs, textTransform: 'uppercase', letterSpacing: tokens.typography.letterSpacing.widest, backgroundColor: 'transparent', border: `${tokens.borders.width} solid rgba(0,0,0,0.2)`, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.4 : 1, transition: `opacity ${tokens.transitions.fast}` }}
          >
            {loading ? '↻ …' : '↻ Refresh'}
          </button>
        </div>
      </div>

      {/* Status ticker */}
      <div style={{ borderTop: `${tokens.borders.width} solid rgba(0,0,0,0.05)`, backgroundColor: 'rgba(0,0,0,0.02)', padding: `${tokens.spacing[1]} 0`, overflow: 'hidden' }}>
        <div style={{ display: 'flex', whiteSpace: 'nowrap', animation: 'marquee 30s linear infinite' }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <span key={i} style={{ fontFamily: tokens.typography.fontFamily.mono, fontSize: '10px', textTransform: 'uppercase', letterSpacing: tokens.typography.letterSpacing.widest, opacity: 0.4, marginRight: tokens.spacing[8] }}>
              ArchLens RIE 2.0 • Architecture Governance Platform • Polling every 30s • {new Date().toLocaleTimeString()}
            </span>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-33.33%); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>
    </nav>
  );
}
