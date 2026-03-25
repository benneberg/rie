import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from 'recharts';
import { tokens } from '../styles/design-system.js';
import type { SnapshotMeta } from '../api/client.js';

interface TrendChartProps {
  snapshots: SnapshotMeta[];
}

interface DataPoint {
  label: string;
  timestamp: number;
  modules: number;
  entities: number;
  dependencies: number;
}

/**
 * Time-series trend chart built with Recharts.
 * Plots modules, entities and dependency counts across snapshots.
 * When fewer than 2 snapshots exist the component shows an empty state.
 */
export function TrendChart({ snapshots }: TrendChartProps) {
  const data: DataPoint[] = [...snapshots]
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
    .map(s => ({
      label: s.commit.slice(0, 7),
      timestamp: new Date(s.timestamp).getTime(),
      modules: s.metrics.totalModules,
      entities: s.metrics.totalEntities,
      dependencies: s.metrics.totalDependencies,
    }));

  if (data.length < 2) {
    return (
      <div style={{
        border: `${tokens.borders.width} solid rgba(0,0,0,0.1)`,
        padding: tokens.spacing[8],
        textAlign: 'center',
        fontFamily: tokens.typography.fontFamily.mono,
        fontSize: tokens.typography.fontSize.xs,
        opacity: 0.5,
      }}>
        Need at least 2 snapshots to show trends.
        Run <code>rie analyze && rie snapshot --create</code> again after your next commit.
      </div>
    );
  }

  const customTooltipStyle = {
    backgroundColor: tokens.colors.void,
    border: 'none',
    borderRadius: 0,
    fontFamily: tokens.typography.fontFamily.mono,
    fontSize: '11px',
    color: tokens.colors.paper,
    padding: '8px 12px',
  };

  return (
    <div style={{
      border: `${tokens.borders.width} solid rgba(0,0,0,0.1)`,
      boxShadow: tokens.shadows.brutal,
      backgroundColor: tokens.colors.paper,
      padding: tokens.spacing[4],
    }}>
      <p style={{
        fontFamily: tokens.typography.fontFamily.mono,
        fontSize: '10px',
        textTransform: 'uppercase',
        letterSpacing: tokens.typography.letterSpacing.widest,
        opacity: 0.4,
        marginBottom: tokens.spacing[4],
      }}>
        Architecture trends · {data.length} snapshots
      </p>

      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="2 2" stroke="rgba(0,0,0,0.06)" />
          <XAxis
            dataKey="label"
            tick={{ fontFamily: tokens.typography.fontFamily.mono, fontSize: 10, fill: 'rgba(0,0,0,0.4)' }}
            axisLine={{ stroke: 'rgba(0,0,0,0.15)' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontFamily: tokens.typography.fontFamily.mono, fontSize: 10, fill: 'rgba(0,0,0,0.4)' }}
            axisLine={false}
            tickLine={false}
            width={40}
          />
          <Tooltip contentStyle={customTooltipStyle} cursor={{ stroke: 'rgba(0,0,0,0.1)', strokeWidth: 1 }} />
          <Legend
            wrapperStyle={{ fontFamily: tokens.typography.fontFamily.mono, fontSize: '10px', paddingTop: '12px' }}
          />
          <Line
            type="monotone"
            dataKey="modules"
            stroke={tokens.colors.cyan}
            strokeWidth={2}
            dot={{ r: 3, fill: tokens.colors.cyan, strokeWidth: 0 }}
            activeDot={{ r: 5, fill: tokens.colors.cyan }}
            name="Modules"
          />
          <Line
            type="monotone"
            dataKey="dependencies"
            stroke={tokens.colors.void}
            strokeWidth={2}
            strokeDasharray="4 2"
            dot={{ r: 3, fill: tokens.colors.void, strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            name="Dependencies"
          />
          <Line
            type="monotone"
            dataKey="entities"
            stroke={tokens.colors.amber}
            strokeWidth={1.5}
            dot={false}
            name="Entities"
          />
          {/* Flag if dependencies grew faster than modules in last 2 points */}
          {data.length >= 2 && (() => {
            const last = data[data.length - 1];
            const prev = data[data.length - 2];
            const depGrowth = last.dependencies - prev.dependencies;
            const modGrowth = last.modules - prev.modules;
            if (depGrowth > modGrowth * 3 && depGrowth > 10) {
              return (
                <ReferenceLine
                  x={last.label}
                  stroke={tokens.colors.alert}
                  strokeDasharray="3 3"
                  label={{ value: '⚠ coupling spike', fill: tokens.colors.alert, fontSize: 10, fontFamily: tokens.typography.fontFamily.mono }}
                />
              );
            }
            return null;
          })()}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
