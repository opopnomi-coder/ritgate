import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme, THEME_PRESETS, ThemePresetId } from '../context/ThemeContext';

interface ThemePresetSelectorProps {
  onScrollLock?: (locked: boolean) => void;
}

const ThemePresetSelector: React.FC<ThemePresetSelectorProps> = ({ onScrollLock }) => {
  const { theme, isDark, activePreset, transitioning, applyPreset, toggleTheme } = useTheme();

  const handlePress = (id: ThemePresetId) => {
    if (transitioning) return;
    applyPreset(id);
  };

  return (
    // Outer wrapper — no overflow:hidden, no clipping
    <View style={[styles.wrapper, { backgroundColor: theme.surface }]}>

      {/* Header row */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="color-palette-outline" size={18} color={theme.primary} />
          <Text style={[styles.headerTitle, { color: theme.text }]}>App Theme</Text>
        </View>
        <View style={styles.darkToggle}>
          <Ionicons
            name={isDark ? 'moon' : 'sunny-outline'}
            size={16}
            color={isDark ? '#A78BFA' : '#F59E0B'}
          />
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: '#E5E7EB', true: '#6D28D9' }}
            thumbColor={isDark ? '#A78BFA' : '#FFFFFF'}
            style={{ transform: [{ scaleX: 0.85 }, { scaleY: 0.85 }] }}
          />
        </View>
      </View>

      {/* Horizontal scroll — extends edge-to-edge */}
      <View
        onTouchStart={() => onScrollLock?.(true)}
        onTouchEnd={() => onScrollLock?.(false)}
        onTouchCancel={() => onScrollLock?.(false)}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.presetRow}
          nestedScrollEnabled
          scrollEventThrottle={16}
          decelerationRate="fast"
        >
          {THEME_PRESETS.map(preset => {
            const isActive = activePreset === preset.id;
            const [c1, c2, c3, c4] = preset.preview;
            return (
              <TouchableOpacity
                key={preset.id}
                style={[
                  styles.presetCard,
                  {
                    backgroundColor: theme.cardBackground || theme.surface,
                    borderColor: isActive ? theme.primary : theme.border,
                    borderWidth: isActive ? 2 : 1,
                  },
                ]}
                onPress={() => handlePress(preset.id)}
                activeOpacity={0.85}
              >
                <View style={styles.swatchRow}>
                  {[c1, c2, c3].map((color, i) => (
                    <View
                      key={i}
                      style={[
                        styles.swatch,
                        { backgroundColor: color },
                        i === 0 && styles.swatchFirst,
                        i === 2 && styles.swatchLast,
                      ]}
                    />
                  ))}
                </View>
                <View style={[styles.miniCard, { backgroundColor: c4 }]}>
                  <View style={[styles.miniBar, { backgroundColor: c1, width: '70%' }]} />
                  <View style={[styles.miniBar, { backgroundColor: c2, width: '50%', opacity: 0.7 }]} />
                  <View style={[styles.miniDot, { backgroundColor: c1 }]} />
                </View>
                <Text style={[styles.presetName, { color: theme.text }]} numberOfLines={1}>
                  {preset.name}
                </Text>
                <Text style={[styles.presetDesc, { color: theme.textTertiary }]} numberOfLines={1}>
                  {preset.description}
                </Text>
                {isActive && (
                  <View style={[styles.activeBadge, { backgroundColor: theme.primary }]}>
                    <Ionicons name="checkmark" size={10} color="#FFF" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Footer */}
      <View style={[styles.activeRow, { borderTopColor: theme.border }]}>
        <View style={[styles.activeDot, { backgroundColor: theme.primary }]} />
        <Text style={[styles.activeLabel, { color: theme.textSecondary }]}>
          {`${THEME_PRESETS.find(p => p.id === activePreset)?.name ?? ''} · ${isDark ? 'Dark' : 'Light'}`}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    // NO overflow:hidden — lets ScrollView extend naturally
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  darkToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  presetRow: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    gap: 10,
    flexDirection: 'row',
  },
  presetCard: {
    width: 120,
    borderRadius: 16,
    padding: 10,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  swatchRow: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  swatch: { flex: 1 },
  swatchFirst: { borderTopLeftRadius: 4, borderBottomLeftRadius: 4 },
  swatchLast: { borderTopRightRadius: 4, borderBottomRightRadius: 4 },
  miniCard: {
    borderRadius: 8,
    padding: 6,
    marginBottom: 8,
    gap: 4,
    height: 48,
    justifyContent: 'center',
  },
  miniBar: { height: 5, borderRadius: 3 },
  miniDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    alignSelf: 'flex-end',
    marginTop: 2,
  },
  presetName: { fontSize: 12, fontWeight: '700', marginBottom: 2 },
  presetDesc: { fontSize: 10, fontWeight: '500' },
  activeBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  activeDot: { width: 8, height: 8, borderRadius: 4 },
  activeLabel: { fontSize: 12, fontWeight: '600' },
});

export default ThemePresetSelector;
