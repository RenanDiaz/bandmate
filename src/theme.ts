/**
 * Bandmate Design System Theme
 *
 * This theme file implements the Bandmate Style Guide v1.0
 * Reference: /STYLE_GUIDE.md
 */

export const theme = {
  // Colors - Dark Theme (Primary)
  colors: {
    dark: {
      bg: {
        primary: '#0A0A0B',
        secondary: '#18181B',
        tertiary: '#27272A',
        elevated: '#3F3F46',
        hover: '#52525B',
      },
      text: {
        primary: '#FAFAFA',
        secondary: '#D4D4D8',
        tertiary: '#A1A1AA',
        disabled: '#71717A',
      },
      border: {
        default: '#3F3F46',
        subtle: '#27272A',
        strong: '#52525B',
      },
    },
    light: {
      bg: {
        primary: '#FFFFFF',
        secondary: '#F9FAFB',
        tertiary: '#F3F4F6',
        elevated: '#E5E7EB',
        hover: '#D1D5DB',
      },
      text: {
        primary: '#18181B',
        secondary: '#3F3F46',
        tertiary: '#71717A',
        disabled: '#A1A1AA',
      },
      border: {
        default: '#E5E7EB',
        subtle: '#F3F4F6',
        strong: '#D1D5DB',
      },
    },
    brand: {
      primary: '#8B5CF6',
      primaryHover: '#7C3AED',
      primaryActive: '#6D28D9',
      primaryLight: '#A78BFA',
      primaryDark: '#5B21B6',
    },
    accent: {
      secondary: '#10B981',
      cyan: '#06B6D4',
      amber: '#F59E0B',
      rose: '#F43F5E',
    },
    semantic: {
      success: '#10B981',
      successBgDark: '#064E3B',
      successBgLight: '#D1FAE5',
      warning: '#F59E0B',
      warningBgDark: '#78350F',
      warningBgLight: '#FEF3C7',
      error: '#EF4444',
      errorBgDark: '#7F1D1D',
      errorBgLight: '#FEE2E2',
      info: '#06B6D4',
      infoBgDark: '#164E63',
      infoBgLight: '#CFFAFE',
    },
  },

  // Gradients
  gradients: {
    brandPrimary: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 50%, #6D28D9 100%)',
    brandMusic: 'linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%)',
    darkOverlay: 'linear-gradient(180deg, rgba(10, 10, 11, 0) 0%, rgba(10, 10, 11, 0.8) 100%)',
  },

  // Typography
  fonts: {
    sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
    mono: "'JetBrains Mono', 'Fira Code', 'Roboto Mono', 'Courier New', monospace",
    display: "'Inter', system-ui, sans-serif",
  },

  fontSizes: {
    // Display sizes
    displayXl: '4rem',      // 64px
    displayLg: '3rem',      // 48px
    displayMd: '2.25rem',   // 36px
    // Heading sizes
    h1: '2rem',             // 32px
    h2: '1.5rem',           // 24px
    h3: '1.25rem',          // 20px
    h4: '1.125rem',         // 18px
    h5: '1rem',             // 16px
    // Body sizes
    bodyLg: '1.125rem',     // 18px
    body: '1rem',           // 16px
    bodySm: '0.875rem',     // 14px
    bodyXs: '0.75rem',      // 12px
  },

  fontWeights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
    extrabold: 800,
  },

  lineHeights: {
    tight: 1.2,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },

  letterSpacing: {
    tighter: '-0.05em',
    tight: '-0.025em',
    normal: '0',
    wide: '0.025em',
    wider: '0.05em',
  },

  // Spacing
  space: {
    0: '0',
    1: '0.25rem',   // 4px
    2: '0.5rem',    // 8px
    3: '0.75rem',   // 12px
    4: '1rem',      // 16px
    5: '1.25rem',   // 20px
    6: '1.5rem',    // 24px
    8: '2rem',      // 32px
    10: '2.5rem',   // 40px
    12: '3rem',     // 48px
    16: '4rem',     // 64px
    20: '5rem',     // 80px
    24: '6rem',     // 96px
  },

  // Container widths
  containers: {
    sm: '640px',
    md: '768px',
    lg: '1024px',
    xl: '1280px',
    full: '100%',
  },

  // Border radius
  radius: {
    none: '0',
    sm: '0.25rem',    // 4px
    base: '0.5rem',   // 8px
    md: '0.75rem',    // 12px
    lg: '1rem',       // 16px
    xl: '1.5rem',     // 24px
    full: '9999px',
  },

  // Shadows - Dark theme
  shadows: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.5)',
    base: '0 2px 4px -1px rgba(0, 0, 0, 0.6), 0 1px 2px -1px rgba(0, 0, 0, 0.5)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.7), 0 2px 4px -1px rgba(0, 0, 0, 0.6)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.8), 0 4px 6px -2px rgba(0, 0, 0, 0.7)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.9), 0 10px 10px -5px rgba(0, 0, 0, 0.8)',
    glow: '0 0 20px rgba(139, 92, 246, 0.4)',
  },

  // Shadows - Light theme
  shadowsLight: {
    sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
    base: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
    md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
    xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
  },

  // Breakpoints
  breakpoints: {
    xs: '0',
    sm: '576px',
    md: '768px',
    lg: '992px',
    xl: '1200px',
    xxl: '1400px',
  },

  // Icon sizes
  iconSizes: {
    xs: '12px',
    sm: '16px',
    base: '20px',
    lg: '24px',
    xl: '32px',
    '2xl': '48px',
    '3xl': '64px',
  },

  // Transitions
  transitions: {
    fast: '150ms',
    base: '200ms',
    slow: '300ms',
    slower: '500ms',
  },

  // Z-index layers
  zIndex: {
    dropdown: 1000,
    sticky: 1020,
    fixed: 1030,
    modalBackdrop: 1040,
    modal: 1050,
    popover: 1060,
    tooltip: 1070,
  },
};

// Type for theme
export type Theme = typeof theme;

// Type for theme mode
export type ThemeMode = 'light' | 'dark';

// Helper function to get colors based on mode
export const getColor = (mode: ThemeMode, path: string) => {
  const parts = path.split('.');
  let value: any = theme.colors[mode];

  for (const part of parts) {
    if (value && typeof value === 'object') {
      value = value[part];
    } else {
      return undefined;
    }
  }

  return value;
};

// Helper function to get shadow based on mode
export const getShadow = (mode: ThemeMode, size: keyof typeof theme.shadows) => {
  return mode === 'dark' ? theme.shadows[size] : theme.shadowsLight[size];
};

export default theme;
