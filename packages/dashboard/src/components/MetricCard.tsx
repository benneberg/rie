import { tokens } from '../styles/design-system.js';

interface MetricCardProps {
  label: string;
  value: number;
  unit?: string;
  trend?: number;
  highlight?: boolean;
  alert?: boolean;
}

export function MetricCard({
  label,
  value,
  unit = '',
  trend,
  highlight = false,
  alert = false,
}: MetricCardProps) {
  const formatValue = (v: number): string => {
    if (v >= 1000) {
      return v.toLocaleString();
    }
    return v.toFixed(1).replace(/\.0$/, '');
  };

  return (
    <div
      className="brutal-card"
      style={{
        backgroundColor: highlight ? tokens.colors.void : tokens.colors.paper,
        color: highlight ? tokens.colors.paper : tokens.colors.graphite,
        padding: tokens.spacing[6],
        cursor: 'default',
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: tokens.spacing[3],
      }}>
        <span style={{
          fontFamily: tokens.typography.fontFamily.label,
          fontSize: tokens.typography.fontSize.xs,
          textTransform: 'uppercase',
          letterSpacing: tokens.typography.letterSpacing.widest,
          opacity: 0.5,
        }}>
          {label}
        </span>
        {trend !== undefined && (
          <span style={{
            fontFamily: tokens.typography.fontFamily.mono,
            fontSize: tokens.typography.fontSize.xs,
            color: trend >= 0 ? tokens.colors.green : tokens.colors.alert,
          }}>
            {trend >= 0 ? '+' : ''}{trend.toFixed(1)}
          </span>
        )}
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: tokens.spacing[1],
      }}>
        <span style={{
          fontSize: 'clamp(2rem, 4vw, 3rem)',
          fontWeight: tokens.typography.fontWeight.black,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}>
          {formatValue(value)}
        </span>
        {unit && (
          <span style={{
            fontFamily: tokens.typography.fontFamily.label,
            fontSize: tokens.typography.fontSize.sm,
            opacity: 0.7,
          }}>
            {unit}
          </span>
        )}
      </div>

      {alert && (
        <div style={{
          marginTop: tokens.spacing[3],
          paddingTop: tokens.spacing[3],
          borderTop: `${tokens.borders.width} solid rgba(255,255,255,0.1)`,
          display: 'flex',
          alignItems: 'center',
          gap: tokens.spacing[2],
          fontFamily: tokens.typography.fontFamily.mono,
          fontSize: tokens.typography.fontSize.xs,
          color: tokens.colors.alert,
        }}>
          <span style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            backgroundColor: 'currentColor',
            animation: 'pulse 1s ease-in-out infinite',
          }} />
          <span>Action Required</span>
        </div>
      )}
    </div>
  );
}
