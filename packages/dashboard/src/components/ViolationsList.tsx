import { tokens } from '../styles/design-system.js';
import type { Violation } from '@archlens/core';

interface ViolationsListProps {
  violations: Violation[];
}

const severityStyles: Record<Violation['severity'], { color: string; bg: string }> = {
  critical: { color: '#ff3b30', bg: 'rgba(255, 59, 48, 0.1)' },
  major: { color: '#ff9500', bg: 'rgba(255, 149, 0, 0.1)' },
  minor: { color: '#ffcc00', bg: 'rgba(255, 204, 0, 0.1)' },
  info: { color: '#007aff', bg: 'rgba(0, 122, 255, 0.1)' },
};

export function ViolationsList({ violations }: ViolationsListProps) {
  return (
    <div style={{
      border: `${tokens.borders.width} solid rgba(0,0,0,0.1)`,
      boxShadow: tokens.shadows.brutal,
      backgroundColor: tokens.colors.paper,
    }}>
      {violations.length === 0 ? (
        <div style={{
          padding: tokens.spacing[8],
          textAlign: 'center',
          color: tokens.colors.green,
          fontFamily: tokens.typography.fontFamily.mono,
          fontSize: tokens.typography.fontSize.sm,
        }}>
          ✓ No violations detected
        </div>
      ) : (
        violations.map((violation, index) => {
          const style = severityStyles[violation.severity];
          const isLast = index === violations.length - 1;

          return (
            <div
              key={violation.id}
              style={{
                padding: tokens.spacing[4],
                borderBottom: isLast ? 'none' : `${tokens.borders.width} solid rgba(0,0,0,0.05)`,
                display: 'flex',
                gap: tokens.spacing[4],
                alignItems: 'flex-start',
                transition: `background-color ${tokens.transitions.fast}`,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.02)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {/* Severity Badge */}
              <div style={{
                padding: `${tokens.spacing[1]} ${tokens.spacing[2]}`,
                backgroundColor: style.bg,
                color: style.color,
                fontFamily: tokens.typography.fontFamily.mono,
                fontSize: '10px',
                fontWeight: tokens.typography.fontWeight.bold,
                textTransform: 'uppercase',
                letterSpacing: tokens.typography.letterSpacing.wide,
                flexShrink: 0,
              }}>
                {violation.severity}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontFamily: tokens.typography.fontFamily.display,
                  fontSize: tokens.typography.fontSize.sm,
                  fontWeight: tokens.typography.fontWeight.medium,
                  marginBottom: tokens.spacing[1],
                  lineHeight: 1.4,
                }}>
                  {violation.message}
                </p>

                <div style={{
                  fontFamily: tokens.typography.fontFamily.mono,
                  fontSize: tokens.typography.fontSize.xs,
                  opacity: 0.5,
                  display: 'flex',
                  gap: tokens.spacing[3],
                  flexWrap: 'wrap',
                }}>
                  <span>{violation.filePath}</span>
                  {violation.lineNumber > 0 && (
                    <span>:{violation.lineNumber}</span>
                  )}
                </div>

                {violation.remediation && (
                  <p style={{
                    marginTop: tokens.spacing[2],
                    fontFamily: tokens.typography.fontFamily.mono,
                    fontSize: tokens.typography.fontSize.xs,
                    color: tokens.colors.cyan,
                    opacity: 0.8,
                  }}>
                    → {violation.remediation}
                  </p>
                )}
              </div>

              {/* Arrow */}
              <div style={{
                color: 'rgba(0,0,0,0.2)',
                transition: `color ${tokens.transitions.fast}`,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
