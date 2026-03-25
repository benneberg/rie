/**
 * Design System Tokens for ArchLens RIE
 * Brutalist aesthetic with precise typography and stark contrasts
 */

export const tokens = {
  // Colors - Brutalist Palette
  colors: {
    void: '#050505',
    paper: '#fafafa',
    concrete: '#e2e2e2',
    graphite: '#1a1a1a',
    cyan: '#00ebf9',
    'cyan-dim': '#00bdc9',
    alert: '#ff3b30',
    amber: '#ff9500',
    green: '#34c759',
  },

  // Typography
  typography: {
    fontFamily: {
      display: "'Inter', sans-serif",
      mono: "'IBM Plex Mono', monospace",
      label: "'Space Grotesk', sans-serif",
    },
    fontSize: {
      xs: '0.75rem',
      sm: '0.875rem',
      base: '1rem',
      lg: '1.125rem',
      xl: '1.25rem',
      '2xl': '1.5rem',
      '3xl': '2rem',
      '4xl': '2.5rem',
      '5xl': '3rem',
    },
    fontWeight: {
      light: 300,
      normal: 400,
      medium: 500,
      bold: 700,
      black: 900,
    },
    letterSpacing: {
      tight: '-0.05em',
      normal: '0',
      wide: '0.05em',
      wider: '0.1em',
      widest: '0.2em',
    },
  },

  // Spacing
  spacing: {
    0: '0',
    1: '0.25rem',
    2: '0.5rem',
    3: '0.75rem',
    4: '1rem',
    6: '1.5rem',
    8: '2rem',
    12: '3rem',
    16: '4rem',
    20: '5rem',
    24: '6rem',
  },

  // Borders
  borders: {
    width: '1px',
    '2': '2px',
    radius: {
      none: '0',
      sm: '2px',
      md: '4px',
      lg: '8px',
      full: '9999px',
    },
  },

  // Shadows (Brutalist - hard edges)
  shadows: {
    brutal: '4px 4px 0px 0px rgba(0, 0, 0, 0.1)',
    'brutal-lg': '6px 6px 0px 0px rgba(0, 0, 0, 0.15)',
    'brutal-xl': '8px 8px 0px 0px rgba(0, 0, 0, 0.2)',
    'brutal-cyan': '4px 4px 0px 0px rgba(0, 235, 249, 0.3)',
  },

  // Transitions
  transitions: {
    fast: '150ms ease',
    normal: '200ms ease',
    slow: '300ms ease',
    spring: '500ms cubic-bezier(0.4, 0, 0.2, 1)',
  },

  // Z-index scale
  zIndex: {
    base: 0,
    dropdown: 100,
    sticky: 200,
    modal: 300,
    toast: 400,
    tooltip: 500,
  },
} as const;

// CSS-in-JS helper for generating styles
export const css = (strings: TemplateStringsArray, ...values: unknown[]) => {
  return strings.reduce((acc, str, i) => {
    return acc + str + (values[i] ?? '');
  }, '');
};

// Global styles
export const globalStyles = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  html {
    scroll-behavior: smooth;
  }

  body {
    font-family: ${tokens.typography.fontFamily.display};
    background-color: ${tokens.colors.paper};
    color: ${tokens.colors.graphite};
    line-height: 1.5;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  /* Custom selection */
  ::selection {
    background: ${tokens.colors.cyan};
    color: ${tokens.colors.void};
  }

  /* Custom scrollbar */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: ${tokens.colors.paper};
  }

  ::-webkit-scrollbar-thumb {
    background: ${tokens.colors.graphite};
  }

  ::-webkit-scrollbar-thumb:hover {
    background: ${tokens.colors.cyan};
  }

  /* Focus states */
  :focus-visible {
    outline: 2px solid ${tokens.colors.cyan};
    outline-offset: 2px;
  }

  /* Brutalist card effect */
  .brutal-card {
    border: ${tokens.borders.width} solid rgba(0, 0, 0, 0.1);
    box-shadow: ${tokens.shadows.brutal};
    transition: all ${tokens.transitions.fast};
  }

  .brutal-card:hover {
    box-shadow: ${tokens.shadows.brutal-lg};
    transform: translate(-2px, -2px);
  }

  /* Text stroke effect */
  .text-stroke {
    -webkit-text-stroke: 1px currentColor;
    -webkit-text-fill-color: transparent;
  }

  .text-stroke:hover {
    -webkit-text-fill-color: currentColor;
  }

  /* Glitch text effect */
  .glitch {
    position: relative;
  }

  .glitch::before,
  .glitch::after {
    content: attr(data-text);
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
  }

  .glitch::before {
    left: 2px;
    text-shadow: -1px 0 ${tokens.colors.alert};
    clip: rect(24px, 550px, 90px, 0);
    animation: glitch-anim-2 3s infinite linear alternate-reverse;
  }

  .glitch::after {
    left: -2px;
    text-shadow: -1px 0 ${tokens.colors.cyan};
    clip: rect(85px, 550px, 140px, 0);
    animation: glitch-anim 2.5s infinite linear alternate-reverse;
  }

  @keyframes glitch-anim {
    0% { clip: rect(10px, 9999px, 85px, 0); }
    20% { clip: rect(63px, 9999px, 130px, 0); }
    40% { clip: rect(25px, 9999px, 15px, 0); }
    60% { clip: rect(88px, 9999px, 95px, 0); }
    80% { clip: rect(45px, 9999px, 60px, 0); }
    100% { clip: rect(15px, 9999px, 110px, 0); }
  }

  @keyframes glitch-anim-2 {
    0% { clip: rect(65px, 9999px, 100px, 0); }
    20% { clip: rect(20px, 9999px, 45px, 0); }
    40% { clip: rect(90px, 9999px, 120px, 0); }
    60% { clip: rect(35px, 9999px, 70px, 0); }
    80% { clip: rect(75px, 9999px, 105px, 0); }
    100% { clip: rect(5px, 9999px, 40px, 0); }
  }
`;
