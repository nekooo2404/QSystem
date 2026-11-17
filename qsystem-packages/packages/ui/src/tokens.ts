export const tokens = {
  light: {
    bg: { base: '#F6F8FB', sidebar: '#EEF2F6', inverse: '#F1F4F8' },
    state: { hover: '#EAEFF5', selected: '#E1E8F0' },
    fg: { base: '#111827', secondary: '#4B5565', muted: '#596377' },
    brand: { primary: '#2C568F', primaryInk: '#FFFFFF', primaryHover: '#234675' },
    button: {
      solid: { bg: '#2C568F', hover: '#234675', text: '#FFFFFF' },
      danger: { bg: '#B91C1C', hover: '#991B1B', text: '#FFFFFF' },
    },
    overlay: { scrim: 'rgb(17 24 39 / 0.36)' },
    shadow: { float: '0 8px 24px rgb(17 24 39 / 0.08)' },
    surface: { 1: '#FFFFFF', 2: '#F1F4F8' },
    accent: { green: '#157339', red: '#B91C1C' },
    border: { base: 'rgb(17 24 39 / 0.09)', muted: 'rgb(17 24 39 / 0.06)', strong: 'rgb(17 24 39 / 0.16)' },
    status: {
      success: { base: '#22C55E', bg: '#F0FDF4', fg: '#157339', border: '#BBF7D0', muted: '#86EFAC' },
      error: { base: '#EF4444', bg: '#FEF2F2', fg: '#B91C1C', border: '#FECACA', muted: '#FCA5A5' },
      warning: { base: '#F59E0B', bg: '#FFFBEB', fg: '#A14808', border: '#FDE68A', muted: '#FCD34D' },
      info: { base: '#2F6690', bg: '#EFF6FF', fg: '#2C568F', border: '#DBEAFE', muted: '#93C5FD' },
    },
  },
  dark: {
    bg: { base: '#111317', sidebar: '#0D0F12', inverse: '#0B0D10' },
    state: { hover: '#1F242C', selected: '#252B35' },
    fg: { base: '#EEF0F5', secondary: '#A3A9B8', muted: '#8C95AB' },
    brand: { primary: '#618DC9', primaryInk: '#091423', primaryHover: '#759ED4' },
    button: {
      solid: { bg: '#618DC9', hover: '#759ED4', text: '#091423' },
      danger: { bg: '#B91C1C', hover: '#991B1B', text: '#FFFFFF' },
    },
    overlay: { scrim: 'rgb(8 10 14 / 0.68)' },
    shadow: { float: '0 12px 32px rgb(0 0 0 / 0.40)' },
    surface: { 1: '#171A20', 2: '#1E222A' },
    accent: { green: '#4CC38A', red: '#F06469' },
    border: { base: 'rgb(238 240 245 / 0.09)', muted: 'rgb(238 240 245 / 0.06)', strong: 'rgb(238 240 245 / 0.16)' },
    status: {
      success: { base: '#22C55E', bg: '#052E16', fg: '#86EFAC', border: '#166534', muted: '#15803D' },
      error: { base: '#EF4444', bg: '#7F1D1D', fg: '#FCA5A5', border: '#991B1B', muted: '#DC2626' },
      warning: { base: '#F59E0B', bg: '#78350F', fg: '#FCD34D', border: '#92400E', muted: '#D97706' },
      info: { base: '#5B8DB8', bg: '#1E3A8A', fg: '#93C5FD', border: '#1E40AF', muted: '#2563EB' },
    },
  },
  highContrast: {
    bg: { base: '#000000', sidebar: '#0F1115', inverse: '#181B22' },
    state: { hover: '#222731', selected: '#27272A' },
    fg: { base: '#FFFFFF', secondary: '#E4E4E7', muted: '#D4D4D8' },
    brand: { primary: '#759ED4', primaryInk: '#091423', primaryHover: '#8FB2DF' },
    button: {
      solid: { bg: '#759ED4', hover: '#FFFFFF', text: '#091423' },
      danger: { bg: '#B91C1C', hover: '#991B1B', text: '#FFFFFF' },
    },
    overlay: { scrim: 'rgb(0 0 0 / 0.8)' },
    shadow: { float: '0 20px 44px rgb(0 0 0 / 0.6)' },
    surface: { 1: '#0F1115', 2: '#222731' },
    accent: { green: '#22C55E', red: '#F87171' },
    border: { base: '#71717A', muted: '#27272A', strong: '#A1A1AA' },
    status: {
      success: { base: '#00FF00', bg: '#000000', fg: '#00FF00', border: '#00FF00', muted: '#00FF00' },
      error: { base: '#FF0000', bg: '#000000', fg: '#FCA5A5', border: '#FF0000', muted: '#FCA5A5' },
      warning: { base: '#FFFF00', bg: '#000000', fg: '#FFFF00', border: '#FFFF00', muted: '#FFFF00' },
      info: { base: '#00FFFF', bg: '#000000', fg: '#00FFFF', border: '#00FFFF', muted: '#00FFFF' },
    },
  },
} as const;

export type Tokens = typeof tokens;
