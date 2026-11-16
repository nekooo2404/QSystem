export const tokens = {
  light: {
    bg: { base: '#F8FAFC', sidebar: '#F1F5F9', inverse: '#F1F5F9' },
    state: { hover: '#E9EFF5', selected: '#E2E8F0' },
    fg: { base: '#18181B', muted: '#52525B' },
    brand: { primary: '#2C568F', primaryInk: '#FFFFFF', primaryHover: '#234675' },
    button: {
      solid: { bg: '#2C568F', hover: '#234675', text: '#FFFFFF' },
      danger: { bg: '#B91C1C', hover: '#991B1B', text: '#FFFFFF' },
    },
    overlay: { scrim: 'rgb(24 24 27 / 0.36)' },
    shadow: { float: '0 18px 40px rgb(24 24 27 / 0.14)' },
    surface: { 1: '#FFFFFF', 2: '#F1F5F9' },
    accent: { green: '#15803D', red: '#B91C1C' },
    border: { base: '#D5DCE4', muted: '#E2E8F0' },
    status: {
      success: { base: '#22C55E', bg: '#F0FDF4', fg: '#15803D', border: '#BBF7D0', muted: '#86EFAC' },
      error: { base: '#EF4444', bg: '#FEF2F2', fg: '#DC2626', border: '#FECACA', muted: '#FCA5A5' },
      warning: { base: '#F59E0B', bg: '#FFFBEB', fg: '#D97706', border: '#FDE68A', muted: '#FCD34D' },
      info: { base: '#2F6690', bg: '#EFF6FF', fg: '#2563EB', border: '#DBEAFE', muted: '#93C5FD' },
    },
  },
  dark: {
    bg: { base: '#111418', sidebar: '#191D23', inverse: '#0D1014' },
    state: { hover: '#222731', selected: '#252B36' },
    fg: { base: '#F3F4F6', muted: '#9CA3AF' },
    brand: { primary: '#618DC9', primaryInk: '#091423', primaryHover: '#759ED4' },
    button: {
      solid: { bg: '#618DC9', hover: '#759ED4', text: '#091423' },
      danger: { bg: '#B91C1C', hover: '#991B1B', text: '#FFFFFF' },
    },
    overlay: { scrim: 'rgb(8 10 14 / 0.68)' },
    shadow: { float: '0 20px 44px rgb(0 0 0 / 0.45)' },
    surface: { 1: '#191D23', 2: '#222731' },
    accent: { green: '#3FB950', red: '#F85149' },
    border: { base: '#30363D', muted: '#222731' },
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
    fg: { base: '#FFFFFF', muted: '#D4D4D8' },
    brand: { primary: '#759ED4', primaryInk: '#091423', primaryHover: '#8FB2DF' },
    button: {
      solid: { bg: '#759ED4', hover: '#FFFFFF', text: '#091423' },
      danger: { bg: '#FF0000', hover: '#CC0000', text: '#FFFFFF' },
    },
    overlay: { scrim: 'rgb(0 0 0 / 0.8)' },
    shadow: { float: '0 20px 44px rgb(0 0 0 / 0.6)' },
    surface: { 1: '#0F1115', 2: '#222731' },
    accent: { green: '#22C55E', red: '#EF4444' },
    border: { base: '#71717A', muted: '#27272A' },
    status: {
      success: { base: '#00FF00', bg: '#000000', fg: '#00FF00', border: '#00FF00', muted: '#00FF00' },
      error: { base: '#FF0000', bg: '#000000', fg: '#FF0000', border: '#FF0000', muted: '#FF0000' },
      warning: { base: '#FFFF00', bg: '#000000', fg: '#FFFF00', border: '#FFFF00', muted: '#FFFF00' },
      info: { base: '#00FFFF', bg: '#000000', fg: '#00FFFF', border: '#00FFFF', muted: '#00FFFF' },
    },
  },
} as const;

export type Tokens = typeof tokens;
