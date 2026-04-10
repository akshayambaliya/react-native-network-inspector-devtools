import { useColorScheme } from 'react-native';

export const LIGHT = {
  // Screen background: light neutral gray — cards pop off it naturally
  background: '#F4F6F8',
  // Card / item background: pure white — maximum contrast against the gray shell
  surface: '#FFFFFF',
  // Nested tertiary areas (code block background tint, secondary cards)
  card: '#F0F2F5',
  // Dividers and borders
  border: '#DDE1E7',
  // Primary text — warm near-black, 15:1 contrast on white (WCAG AAA)
  text: '#111827',
  // Secondary / label text — neutral gray, ≥4.5:1 on white (WCAG AA)
  textSecondary: '#6B7280',
  // Code block shell
  codeBg: '#1A1F2E',
  codeText: '#E5E9F0',
  primary: '#2563EB',
  danger: '#DC2626',
  success: '#16A34A',
  warning: '#D97706',
  mockBanner: '#FEF3C7',
  mockBannerText: '#92400E',
  mockBannerBorder: '#D97706',
};

export const DARK = {
  background: '#0F172A',
  surface: '#1E293B',
  card: '#334155',
  border: '#475569',
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  codeBg: '#020617',
  codeText: '#E2E8F0',
  primary: '#3B82F6',
  danger: '#EF4444',
  success: '#22C55E',
  warning: '#F59E0B',
  mockBanner: '#78350F',
  mockBannerText: '#FDE68A',
  mockBannerBorder: '#D97706',
};

export type Theme = typeof LIGHT;

export const useTheme = (): Theme => {
  const scheme = useColorScheme();
  return scheme === 'dark' ? DARK : LIGHT;
};

export const METHOD_COLORS: Record<string, string> = {
  GET: '#2563EB',
  POST: '#7C3AED',
  PUT: '#EA580C',
  DELETE: '#DC2626',
  PATCH: '#D97706',
};
