import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  ReactNode,
} from 'react';
import { Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Token types ─────────────────────────────────────────────────────────────
export interface Theme {
  type: 'light' | 'dark';
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  cardBackground: string;
  text: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  border: string;
  error: string;
  success: string;
  warning: string;
  info: string;
  surfaceHighlight: string;
  inputBackground: string;
  gradients: {
    primary: string[];
    secondary: string[];
    error: string[];
  };
}

export type ThemePresetId = 'ocean' | 'neon' | 'sunset' | 'minimal';

export interface ThemePreset {
  id: ThemePresetId;
  name: string;
  description: string;
  preview: string[];   // [primary, secondary, accent, bg]
  light: Partial<Theme>;
  dark: Partial<Theme>;
}

// ─── 4 Premium Presets ────────────────────────────────────────────────────────
export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'ocean',
    name: 'Ocean Blue',
    description: 'Professional & calm',
    preview: ['#00B4D8', '#0077B6', '#90E0EF', '#F0F9FF'],
    light: {
      primary: '#00B4D8',
      secondary: '#0077B6',
      accent: '#90E0EF',
      background: '#F0F9FF',
      surface: '#FFFFFF',
      cardBackground: '#FFFFFF',
      text: '#0C1A2E',
      textSecondary: '#4A6FA5',
      textTertiary: '#8BAFD4',
      border: '#CAE0F5',
      surfaceHighlight: '#E0F2FE',
      inputBackground: '#F0F9FF',
      gradients: {
        primary: ['#00B4D8', '#0077B6'],
        secondary: ['#0077B6', '#023E8A'],
        error: ['#EF4444', '#DC2626'],
      },
    },
    dark: {
      primary: '#00B4D8',
      secondary: '#0096C7',
      accent: '#48CAE4',
      background: '#03045E',
      surface: '#023E8A',
      cardBackground: '#0077B6',
      text: '#CAF0F8',
      textSecondary: '#90E0EF',
      textTertiary: '#48CAE4',
      border: '#0096C7',
      surfaceHighlight: '#0077B6',
      inputBackground: '#023E8A',
      gradients: {
        primary: ['#00B4D8', '#0096C7'],
        secondary: ['#0096C7', '#023E8A'],
        error: ['#EF4444', '#DC2626'],
      },
    },
  },
  {
    id: 'neon',
    name: 'Dark Neon',
    description: 'Futuristic & bold',
    preview: ['#00F5D4', '#0B132B', '#6FFFE9', '#0B132B'],
    light: {
      primary: '#00C9A7',
      secondary: '#1A1A2E',
      accent: '#00F5D4',
      background: '#F0FFFE',
      surface: '#FFFFFF',
      cardBackground: '#FFFFFF',
      text: '#0B132B',
      textSecondary: '#16213E',
      textTertiary: '#0F3460',
      border: '#B2F5EA',
      surfaceHighlight: '#E6FFFA',
      inputBackground: '#F0FFFE',
      gradients: {
        primary: ['#00F5D4', '#00C9A7'],
        secondary: ['#0B132B', '#1A1A2E'],
        error: ['#FF4D6D', '#C9184A'],
      },
    },
    dark: {
      primary: '#00F5D4',
      secondary: '#0B132B',
      accent: '#6FFFE9',
      background: '#050D1A',
      surface: '#0B132B',
      cardBackground: '#111827',
      text: '#E0FFFC',
      textSecondary: '#6FFFE9',
      textTertiary: '#00C9A7',
      border: '#1A3A4A',
      surfaceHighlight: '#0F2030',
      inputBackground: '#0B132B',
      gradients: {
        primary: ['#00F5D4', '#00C9A7'],
        secondary: ['#6FFFE9', '#00F5D4'],
        error: ['#FF4D6D', '#C9184A'],
      },
    },
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Warm & creative',
    preview: ['#FF6B6B', '#FF9F1C', '#FFE66D', '#FFF8F0'],
    light: {
      primary: '#FF6B6B',
      secondary: '#FF9F1C',
      accent: '#FFE66D',
      background: '#FFF8F0',
      surface: '#FFFFFF',
      cardBackground: '#FFFFFF',
      text: '#2D1B00',
      textSecondary: '#7C4A00',
      textTertiary: '#B87333',
      border: '#FFD9B3',
      surfaceHighlight: '#FFF0E0',
      inputBackground: '#FFF8F0',
      gradients: {
        primary: ['#FF6B6B', '#FF9F1C'],
        secondary: ['#FF9F1C', '#FFE66D'],
        error: ['#EF4444', '#DC2626'],
      },
    },
    dark: {
      primary: '#FF6B6B',
      secondary: '#FF9F1C',
      accent: '#FFE66D',
      background: '#1A0A00',
      surface: '#2D1500',
      cardBackground: '#3D1F00',
      text: '#FFF0E0',
      textSecondary: '#FFD9B3',
      textTertiary: '#FFB347',
      border: '#5C3000',
      surfaceHighlight: '#3D1F00',
      inputBackground: '#2D1500',
      gradients: {
        primary: ['#FF6B6B', '#FF9F1C'],
        secondary: ['#FF9F1C', '#FFE66D'],
        error: ['#EF4444', '#DC2626'],
      },
    },
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'Clean & premium',
    preview: ['#111111', '#333333', '#666666', '#FFFFFF'],
    light: {
      primary: '#111111',
      secondary: '#333333',
      accent: '#555555',
      background: '#FFFFFF',
      surface: '#FAFAFA',
      cardBackground: '#FFFFFF',
      text: '#111111',
      textSecondary: '#555555',
      textTertiary: '#888888',
      border: '#E5E5E5',
      surfaceHighlight: '#F5F5F5',
      inputBackground: '#F9F9F9',
      gradients: {
        primary: ['#111111', '#333333'],
        secondary: ['#333333', '#555555'],
        error: ['#EF4444', '#DC2626'],
      },
    },
    dark: {
      primary: '#FFFFFF',
      secondary: '#CCCCCC',
      accent: '#AAAAAA',
      background: '#0A0A0A',
      surface: '#141414',
      cardBackground: '#1A1A1A',
      text: '#FFFFFF',
      textSecondary: '#AAAAAA',
      textTertiary: '#666666',
      border: '#2A2A2A',
      surfaceHighlight: '#1F1F1F',
      inputBackground: '#141414',
      gradients: {
        primary: ['#FFFFFF', '#CCCCCC'],
        secondary: ['#CCCCCC', '#AAAAAA'],
        error: ['#EF4444', '#DC2626'],
      },
    },
  },
];

// ─── Base themes (fallback) ───────────────────────────────────────────────────
const BASE_LIGHT: Theme = {
  type: 'light',
  primary: '#22D3EE',
  secondary: '#0EA5E9',
  accent: '#22D3EE',
  background: '#F8FAFC',
  surface: '#FFFFFF',
  cardBackground: '#FFFFFF',
  text: '#1F2937',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  textInverse: '#FFFFFF',
  border: '#E5E7EB',
  error: '#EF4444',
  success: '#10B981',
  warning: '#F59E0B',
  info: '#06B6D4',
  surfaceHighlight: '#F3F4F6',
  inputBackground: '#F9FAFB',
  gradients: {
    primary: ['#22D3EE', '#0EA5E9'],
    secondary: ['#0EA5E9', '#3B82F6'],
    error: ['#EF4444', '#DC2626'],
  },
};

const BASE_DARK: Theme = {
  type: 'dark',
  primary: '#22D3EE',
  secondary: '#0EA5E9',
  accent: '#22D3EE',
  background: '#0F172A',
  surface: '#1E293B',
  cardBackground: '#1E293B',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  textTertiary: '#64748B',
  textInverse: '#0F172A',
  border: '#334155',
  error: '#EF4444',
  success: '#10B981',
  warning: '#F59E0B',
  info: '#06B6D4',
  surfaceHighlight: '#334155',
  inputBackground: '#1E293B',
  gradients: {
    primary: ['#22D3EE', '#0EA5E9'],
    secondary: ['#0EA5E9', '#3B82F6'],
    error: ['#EF4444', '#DC2626'],
  },
};

// ─── Context type ─────────────────────────────────────────────────────────────
interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  activePreset: ThemePresetId;
  transitioning: boolean;
  toggleTheme: () => void;
  applyPreset: (presetId: ThemePresetId) => void;
  resetTheme: () => void;
  /** Animated opacity value (0→1) that fires on every theme change — use for fade transitions */
  transitionOpacity: Animated.Value;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// ─── Storage helpers (user-specific keys) ────────────────────────────────────
const storageKey = (suffix: string, userId?: string) =>
  userId ? `theme_${suffix}_${userId}` : `theme_${suffix}`;

// ─── Provider ─────────────────────────────────────────────────────────────────
export const ThemeProvider: React.FC<{ children: ReactNode; userId?: string }> = ({
  children,
  userId,
}) => {
  const [isDark, setIsDark] = useState(false);
  const [activePreset, setActivePreset] = useState<ThemePresetId>('ocean');
  const [transitioning, setTransitioning] = useState(false);
  const transitionOpacity = useRef(new Animated.Value(1)).current;

  // Load on mount / userId change
  useEffect(() => {
    loadPreferences();
  }, [userId]);

  const loadPreferences = async () => {
    try {
      const [savedMode, savedPreset] = await Promise.all([
        AsyncStorage.getItem(storageKey('mode', userId)),
        AsyncStorage.getItem(storageKey('preset', userId)),
      ]);
      if (savedMode)   setIsDark(savedMode === 'dark');
      if (savedPreset) setActivePreset(savedPreset as ThemePresetId);
    } catch (e) {
      console.error('ThemeContext: load error', e);
    }
  };

  // ── Smooth transition helper ──────────────────────────────────────────────
  const runTransition = useCallback((action: () => void) => {
    setTransitioning(true);
    Animated.timing(transitionOpacity, {
      toValue: 0.3,
      duration: 180,
      useNativeDriver: true,
    }).start(() => {
      action();
      Animated.timing(transitionOpacity, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }).start(() => setTransitioning(false));
    });
  }, []);

  // ── Toggle dark / light ───────────────────────────────────────────────────
  const toggleTheme = useCallback(() => {
    runTransition(() => {
      const next = !isDark;
      setIsDark(next);
      AsyncStorage.setItem(storageKey('mode', userId), next ? 'dark' : 'light').catch(() => {});
    });
  }, [isDark, userId, runTransition]);

  // ── Apply preset ──────────────────────────────────────────────────────────
  const applyPreset = useCallback((presetId: ThemePresetId) => {
    runTransition(() => {
      setActivePreset(presetId);
      Promise.all([
        AsyncStorage.setItem(storageKey('preset', userId), presetId),
      ]).catch(() => {});
    });
  }, [userId, runTransition]);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const resetTheme = useCallback(() => {
    runTransition(() => {
      setActivePreset('ocean');
      setIsDark(false);
      Promise.all([
        AsyncStorage.setItem(storageKey('preset', userId), 'ocean'),
        AsyncStorage.setItem(storageKey('mode', userId), 'light'),
      ]).catch(() => {});
    });
  }, [userId, runTransition]);

  // ── Build active theme ────────────────────────────────────────────────────
  const buildTheme = (): Theme => {
    const base = isDark ? { ...BASE_DARK } : { ...BASE_LIGHT };
    base.type = isDark ? 'dark' : 'light';
    const preset = THEME_PRESETS.find(p => p.id === activePreset);
    if (preset) {
      const presetColors = isDark ? preset.dark : preset.light;
      Object.assign(base, presetColors);
    }
    return { ...base, type: isDark ? 'dark' : 'light' };
  };

  const theme = buildTheme();

  return (
    <ThemeContext.Provider
      value={{
        theme,
        isDark,
        activePreset,
        transitioning,
        toggleTheme,
        applyPreset,
        resetTheme,
        transitionOpacity,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
