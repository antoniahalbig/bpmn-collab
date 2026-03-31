/**
 * Design tokens — single source of truth for colours, shadows, radii, and
 * typography used across the side-panel UI. 
 */

export const colors = {
  // Borders
  border: '#ddd',
  borderSubtle: '#eee',
  borderFaint: '#f0f0f0',
  borderFaintest: '#f5f5f5',

  // Brand / interactive
  primary: '#3498db',
  danger: '#e74c3c',

  // Backgrounds
  panelBg: '#fff',
  panelBgTranslucent: 'rgba(255, 255, 255, 0.95)',

  // Text scale (darkest → lightest)
  textStrong: '#222',
  textPrimary: '#333',
  textSecondary: '#444',
  textMuted: '#555',
  textFaint: '#888',
  textPlaceholder: '#999',
  textDim: '#aaa',
  textDimmer: '#bbb',
} as const

export const shadows = {
  panel: '0 2px 8px rgba(0,0,0,0.12)',
} as const

export const radii = {
  sm: 4,
  md: 8,
} as const

export const fonts = {
  family: 'sans-serif',
  size: {
    xs: 10,
    sm: 11,
    base: 12,
    md: 13,
    lg: 14,
  },
} as const
