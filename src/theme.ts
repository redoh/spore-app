export const theme = {
  colors: {
    bgDeep: '#03060f',
    bgSurface: '#0b1226',
    bgPanel: '#111a36',
    accent: '#6cf0d3',
    accentSoft: '#2a8b78',
    danger: '#ff5b6e',
    warning: '#ffb74d',
    plant: '#7be38a',
    meat: '#ff8a8a',
    dna: '#a98bff',
    text: '#e8ecff',
    textDim: '#7d88a8',
    border: '#1c2748',
    player: '#6cf0d3',
    playerInner: '#0a1f1a',
  },
  font: {
    title: 32,
    heading: 22,
    body: 16,
    small: 13,
  },
  radius: {
    sm: 8,
    md: 14,
    lg: 22,
  },
} as const;

export type Theme = typeof theme;
