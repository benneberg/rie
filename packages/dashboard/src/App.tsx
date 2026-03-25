import { useState } from 'react';
import { tokens } from './styles/design-system.js';
import { Navigation } from './components/Navigation.js';
import { MetricCard } from './components/MetricCard.js';
import { ViolationsList } from './components/ViolationsList.js';
import { GraphVisualization } from './components/GraphVisualization.js';
import { SnapshotBrowser } from './components/SnapshotBrowser.js';
import { TrendChart } from './components/TrendChart.js';
import { DependencyMatrix } from './components/DependencyMatrix.js';
import { useSnapshot } from './hooks/useSnapshot.js';

type Tab = 'overview' | 'matrix' | 'violations' | 'history';

function App() {
  const { graph, metrics, violations, snapshots, loading, error, refresh, loadSnapshot } =
    useSnapshot();
  const [activeTab, setActiveTab] = useState<Tab>('overview');

  const tabs: { id: Tab; label: string; badge?: number }[] = [
    { id: 'overview',   label: 'Overview' },
    { id: 'matrix',     label: 'Dependency Matrix' },
    { id: 'violations', label: 'Violations', badge: metrics?.activeViolations },
    { id: 'history',    label: 'History' },
  ];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: tokens.colors.paper, fontFamily: tokens.typography.fontFamily.display }}>
      {/* Skip-to-content link for keyboard users */}
      <a
        href="#main-content"
        style={{ position: 'absolute', left: '-9999px', top: 'auto', width: 1, height: 1, overflow: 'hidden' }}
        onFocus={e => { e.currentTarget.style.left = '16px'; e.currentTarget.style.top = '16px'; e.currentTarget.style.width = 'auto'; e.currentTarget.style.height = 'auto'; }}
        onBlur={e => { e.currentTarget.style.left = '-9999px'; e.currentTarget.style.top = 'auto'; e.currentTarget.style.width = '1px'; e.currentTarget.style.height = '1px'; }}
      >
        Skip to content
      </a>

      <Navigation onRefresh={refresh} loading={loading} />

      {/* Error banner */}
      {error && (
        <div role="alert" style={{ backgroundColor: tokens.colors.alert, color: 'white', padding: `${tokens.spacing[3]} ${tokens.spacing[6]}`, fontFamily: tokens.typography.fontFamily.mono, fontSize: tokens.typography.fontSize.xs, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>⚠ {error} — showing last known state</span>
          <button
            onClick={refresh}
            aria-label="Retry loading snapshot"
            style={{ background: 'none', border: '1px solid white', color: 'white', padding: `${tokens.spacing[1]} ${tokens.spacing[3]}`, cursor: 'pointer', fontFamily: tokens.typography.fontFamily.mono, fontSize: tokens.typography.fontSize.xs }}
          >
            Retry
          </button>
        </div>
      )}

      {/* Hero */}
      <header style={{ padding: `${tokens.spacing[12]} ${tokens.spacing[4]} ${tokens.spacing[6]}`, borderBottom: `${tokens.borders.width} solid rgba(0,0,0,0.1)` }}>
        <div style={{ maxWidth: '1800px', margin: '0 auto' }}>
          <p style={{ fontFamily: tokens.typography.fontFamily.label, fontSize: tokens.typography.fontSize.xs, letterSpacing: tokens.typography.letterSpacing.widest, color: tokens.colors.cyan, textTransform: 'uppercase', marginBottom: tokens.spacing[2] }}>
            Architecture Intelligence Engine
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-end', gap: tokens.spacing[4] }}>
            <h1 style={{ fontSize: 'clamp(1.8rem, 5vw, 4rem)', fontWeight: tokens.typography.fontWeight.black, letterSpacing: tokens.typography.letterSpacing.tight, lineHeight: 1, margin: 0 }}>
              ARCHLENS<span style={{ color: tokens.colors.cyan }}>.</span>RIE
            </h1>
            {graph && (
              <div style={{ textAlign: 'right', fontFamily: tokens.typography.fontFamily.mono, fontSize: tokens.typography.fontSize.xs, opacity: 0.5 }}>
                <div>Snapshot: <strong>{graph.metadata.commit?.slice(0, 7) ?? 'local'}</strong></div>
                <div>Project: {graph.metadata.projectName}</div>
                <div>Updated: {new Date(graph.updatedAt).toLocaleTimeString()}</div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Metrics */}
      <section aria-label="Architecture metrics" style={{ padding: `${tokens.spacing[6]} ${tokens.spacing[4]}`, backgroundColor: tokens.colors.concrete }}>
        <div style={{ maxWidth: '1800px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: tokens.spacing[3] }}>
          {loading && !metrics ? (
            <div aria-live="polite" style={{ gridColumn: '1/-1', padding: tokens.spacing[8], textAlign: 'center', fontFamily: tokens.typography.fontFamily.mono, fontSize: tokens.typography.fontSize.xs, opacity: 0.5 }}>
              Loading snapshot…
            </div>
          ) : metrics ? (
            <>
              <MetricCard label="Fitness Score" value={metrics.fitnessScore} unit="%" highlight />
              <MetricCard label="Layer Purity"  value={metrics.layerPurity}  unit="%" />
              <MetricCard label="Modules"       value={metrics.totalModules} />
              <MetricCard label="Entities"      value={metrics.totalEntities} />
              <MetricCard label="Dependencies"  value={metrics.totalDependencies} />
              <MetricCard label="Violations"    value={metrics.activeViolations} alert={metrics.activeViolations > 0} />
            </>
          ) : null}
        </div>
      </section>

      {/* Tab bar */}
      <nav aria-label="Dashboard sections" style={{ borderBottom: `${tokens.borders.width} solid rgba(0,0,0,0.1)`, backgroundColor: tokens.colors.paper, overflowX: 'auto' }}>
        <div style={{ maxWidth: '1800px', margin: '0 auto', padding: `0 ${tokens.spacing[4]}`, display: 'flex', gap: 0, whiteSpace: 'nowrap' }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: `${tokens.spacing[3]} ${tokens.spacing[4]}`,
                fontFamily: tokens.typography.fontFamily.label,
                fontSize: tokens.typography.fontSize.xs,
                textTransform: 'uppercase',
                letterSpacing: tokens.typography.letterSpacing.widest,
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab.id ? `2px solid ${tokens.colors.cyan}` : '2px solid transparent',
                color: activeTab === tab.id ? tokens.colors.graphite : 'rgba(0,0,0,0.4)',
                cursor: 'pointer',
                fontWeight: activeTab === tab.id ? tokens.typography.fontWeight.bold : tokens.typography.fontWeight.normal,
                flexShrink: 0,
              }}
            >
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span aria-label={`${tab.badge} violations`} style={{ marginLeft: tokens.spacing[2], backgroundColor: tokens.colors.alert, color: 'white', borderRadius: '9999px', padding: '1px 6px', fontSize: '10px' }}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>

      {/* Main content */}
      <main id="main-content" role="tabpanel" style={{ padding: `${tokens.spacing[8]} ${tokens.spacing[4]}`, maxWidth: '1800px', margin: '0 auto' }}>

        {/* ── Overview ── */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: tokens.spacing[8] }}>
            {/* Graph + Violations row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: tokens.spacing[8] }}>
              <section aria-label="Architecture graph">
                <h2 style={{ fontFamily: tokens.typography.fontFamily.label, fontSize: tokens.typography.fontSize.sm, textTransform: 'uppercase', letterSpacing: tokens.typography.letterSpacing.widest, marginBottom: tokens.spacing[4], opacity: 0.5 }}>
                  Architecture Graph
                </h2>
                <GraphVisualization graph={graph} />
              </section>
              <section aria-label="Recent violations">
                <h2 style={{ fontFamily: tokens.typography.fontFamily.label, fontSize: tokens.typography.fontSize.sm, textTransform: 'uppercase', letterSpacing: tokens.typography.letterSpacing.widest, marginBottom: tokens.spacing[4], opacity: 0.5 }}>
                  Recent Violations
                </h2>
                <ViolationsList violations={violations.slice(0, 5)} />
                {violations.length > 5 && (
                  <button onClick={() => setActiveTab('violations')} style={{ marginTop: tokens.spacing[3], width: '100%', padding: tokens.spacing[3], fontFamily: tokens.typography.fontFamily.mono, fontSize: tokens.typography.fontSize.xs, textTransform: 'uppercase', letterSpacing: tokens.typography.letterSpacing.widest, background: 'none', border: `${tokens.borders.width} solid rgba(0,0,0,0.15)`, cursor: 'pointer', opacity: 0.6 }}>
                    View all {violations.length} violations →
                  </button>
                )}
              </section>
            </div>

            {/* Trend chart */}
            <section aria-label="Architecture trends">
              <h2 style={{ fontFamily: tokens.typography.fontFamily.label, fontSize: tokens.typography.fontSize.sm, textTransform: 'uppercase', letterSpacing: tokens.typography.letterSpacing.widest, marginBottom: tokens.spacing[4], opacity: 0.5 }}>
                Trends
              </h2>
              <TrendChart snapshots={snapshots} />
            </section>
          </div>
        )}

        {/* ── Dependency Matrix ── */}
        {activeTab === 'matrix' && (
          <section aria-label="Dependency matrix">
            <h2 style={{ fontFamily: tokens.typography.fontFamily.label, fontSize: tokens.typography.fontSize.sm, textTransform: 'uppercase', letterSpacing: tokens.typography.letterSpacing.widest, marginBottom: tokens.spacing[4], opacity: 0.5 }}>
              Module Dependency Matrix
            </h2>
            <p style={{ fontFamily: tokens.typography.fontFamily.mono, fontSize: tokens.typography.fontSize.xs, opacity: 0.5, marginBottom: tokens.spacing[6] }}>
              Rows = source · Columns = target · Cyan = dependency · Red = layer violation
            </p>
            <DependencyMatrix graph={graph} />
          </section>
        )}

        {/* ── All Violations ── */}
        {activeTab === 'violations' && (
          <section aria-label="All violations">
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', marginBottom: tokens.spacing[6], gap: tokens.spacing[4] }}>
              <h2 style={{ fontFamily: tokens.typography.fontFamily.label, fontSize: tokens.typography.fontSize.sm, textTransform: 'uppercase', letterSpacing: tokens.typography.letterSpacing.widest, opacity: 0.5 }}>
                All Violations ({violations.length})
              </h2>
              {metrics && (
                <div style={{ display: 'flex', gap: tokens.spacing[4], fontFamily: tokens.typography.fontFamily.mono, fontSize: tokens.typography.fontSize.xs }}>
                  <span style={{ color: tokens.colors.alert }}>● {metrics.criticalViolations} critical</span>
                  <span style={{ color: tokens.colors.amber }}>● {metrics.majorViolations} major</span>
                </div>
              )}
            </div>
            <ViolationsList violations={violations} />
          </section>
        )}

        {/* ── History ── */}
        {activeTab === 'history' && (
          <section aria-label="Snapshot history">
            <h2 style={{ fontFamily: tokens.typography.fontFamily.label, fontSize: tokens.typography.fontSize.sm, textTransform: 'uppercase', letterSpacing: tokens.typography.letterSpacing.widest, marginBottom: tokens.spacing[6], opacity: 0.5 }}>
              Snapshot History
            </h2>
            <SnapshotBrowser
              snapshots={snapshots}
              currentSnapshotId={graph?.metadata.commit}
              onSelect={loadSnapshot}
              loading={loading}
            />
          </section>
        )}
      </main>

      <footer style={{ padding: `${tokens.spacing[8]} ${tokens.spacing[4]}`, borderTop: `${tokens.borders.width} solid rgba(0,0,0,0.1)`, marginTop: tokens.spacing[12] }}>
        <div style={{ maxWidth: '1800px', margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: tokens.spacing[4], fontFamily: tokens.typography.fontFamily.mono, fontSize: tokens.typography.fontSize.xs, opacity: 0.5 }}>
          <span>ArchLens RIE v2.0.0 · Apache 2.0</span>
          <span>Build: {Date.now().toString(16)}</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
