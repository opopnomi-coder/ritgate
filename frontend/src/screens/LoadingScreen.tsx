import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  StatusBar,
  Dimensions,
  Image,
  Easing,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';

const { width: W, height: H } = Dimensions.get('window');

// ─── Pulsing ring component ───────────────────────────────────────────────────
const PulseRing: React.FC<{ delay: number; size: number; color: string }> = ({
  delay,
  size,
  color,
}) => {
  const scale = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0.7)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1,
            duration: 2000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0,
            duration: 2000,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scale, { toValue: 0.4, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0.7, duration: 0, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 1.5,
        borderColor: color,
        opacity,
        transform: [{ scale }],
      }}
    />
  );
};

// ─── Floating dot ─────────────────────────────────────────────────────────────
const FloatingDot: React.FC<{ x: number; y: number; delay: number; size: number }> = ({
  x, y, delay, size,
}) => {
  const translateY = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: -18,
            duration: 1800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.8,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(translateY, {
            toValue: 0,
            duration: 1800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.3,
            duration: 900,
            useNativeDriver: true,
          }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: 'rgba(99,179,237,0.6)',
        opacity,
        transform: [{ translateY }],
      }}
    />
  );
};

// ─── Main LoadingScreen ───────────────────────────────────────────────────────
const LoadingScreen: React.FC = () => {
  const { theme, isDark } = useTheme();
  // Logo animations
  const logoScale   = useRef(new Animated.Value(0)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoGlow    = useRef(new Animated.Value(0)).current;

  // Text animations
  const titleOpacity    = useRef(new Animated.Value(0)).current;
  const titleTranslateY = useRef(new Animated.Value(20)).current;
  const subOpacity      = useRef(new Animated.Value(0)).current;
  const subTranslateY   = useRef(new Animated.Value(16)).current;

  // Scan line
  const scanY = useRef(new Animated.Value(-80)).current;

  // Progress
  const progress = useRef(new Animated.Value(0)).current;

  // Bottom badge
  const badgeOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 1. Logo pops in
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, {
          toValue: 1,
          tension: 55,
          friction: 7,
          useNativeDriver: true,
        }),
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ]),

      // 2. Title slides up
      Animated.parallel([
        Animated.timing(titleOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(titleTranslateY, {
          toValue: 0,
          duration: 400,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
      ]),

      // 3. Subtitle
      Animated.parallel([
        Animated.timing(subOpacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(subTranslateY, {
          toValue: 0,
          duration: 350,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]),

      // 4. Badge
      Animated.timing(badgeOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Logo glow pulse (loops)
    Animated.loop(
      Animated.sequence([
        Animated.timing(logoGlow, {
          toValue: 1,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(logoGlow, {
          toValue: 0,
          duration: 1400,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Scan line sweeps down repeatedly
    Animated.loop(
      Animated.sequence([
        Animated.timing(scanY, {
          toValue: 80,
          duration: 1600,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(scanY, {
          toValue: -80,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(600),
      ])
    ).start();

    // Progress bar fills over 2.8s
    Animated.timing(progress, {
      toValue: 1,
      duration: 2800,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: false,
    }).start();
  }, []);

  const glowOpacity = logoGlow.interpolate({
    inputRange: [0, 1],
    outputRange: [0.25, 0.65],
  });

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} backgroundColor="transparent" translucent />

      {/* Background gradient layers */}
      <View style={[styles.bgLayer1, { backgroundColor: isDark ? '#0A1628' : theme.surfaceHighlight }]} />
      <View style={[styles.bgLayer2, { backgroundColor: isDark ? '#071020' : theme.surface }]} />
      <View style={[styles.bgLayer3, { backgroundColor: theme.primary + '18' }]} />

      {/* Floating ambient dots */}
      <FloatingDot x={W * 0.08} y={H * 0.12} delay={0}    size={6} />
      <FloatingDot x={W * 0.85} y={H * 0.18} delay={400}  size={4} />
      <FloatingDot x={W * 0.15} y={H * 0.72} delay={800}  size={5} />
      <FloatingDot x={W * 0.78} y={H * 0.68} delay={200}  size={7} />
      <FloatingDot x={W * 0.50} y={H * 0.08} delay={600}  size={4} />
      <FloatingDot x={W * 0.92} y={H * 0.45} delay={1000} size={5} />

      {/* Center content */}
      <View style={styles.center}>

        {/* Pulse rings behind logo */}
        <View style={styles.ringsWrap}>
          <PulseRing delay={0}    size={180} color={theme.primary + '80'} />
          <PulseRing delay={600}  size={240} color={theme.primary + '4D'} />
          <PulseRing delay={1200} size={300} color={theme.primary + '26'} />
        </View>

        {/* Glow halo */}
        <Animated.View style={[styles.glowHalo, { opacity: glowOpacity, backgroundColor: theme.primary + '38' }]} />

        {/* Logo container with scan line */}
        <Animated.View
          style={[
            styles.logoWrap,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }],
              borderColor: theme.primary + '59',
              backgroundColor: theme.primary + '0F',
            },
          ]}
        >
          <Image
            source={require('../../assets/rit-logo.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          {/* Scan line sweeps over logo */}
          <Animated.View
            style={[
              styles.scanLine,
              { transform: [{ translateY: scanY }], backgroundColor: theme.accent + '8C' },
            ]}
          />
        </Animated.View>

        {/* App name */}
        <Animated.Text
          style={[
            styles.title,
            {
              opacity: titleOpacity,
              transform: [{ translateY: titleTranslateY }],
              color: theme.text,
            },
          ]}
        >
          RIT Gate
        </Animated.Text>

        {/* Tagline */}
        <Animated.Text
          style={[
            styles.subtitle,
            {
              opacity: subOpacity,
              transform: [{ translateY: subTranslateY }],
              color: theme.primary,
            },
          ]}
        >
          INSTITUTIONAL SECURITY SYSTEM
        </Animated.Text>

        {/* Divider dots */}
        <Animated.View style={[styles.dotRow, { opacity: subOpacity }]}>
          {[0, 1, 2].map(i => (
            <View key={i} style={[styles.dividerDot, { backgroundColor: theme.primary + '80' }]} />
          ))}
        </Animated.View>
      </View>

      {/* Bottom section */}
      <View style={styles.bottom}>
        {/* Progress bar */}
        <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
          <Animated.View style={[styles.progressFill, { width: progressWidth, backgroundColor: theme.primary }]}>
            {/* Shimmer on progress bar */}
            <View style={styles.progressShimmer} />
          </Animated.View>
        </View>

        <Animated.View style={[styles.badge, { opacity: badgeOpacity }]}>
          <View style={[styles.badgeDot, { backgroundColor: theme.primary }]} />
          <Text style={[styles.badgeText, { color: theme.primary + 'B3' }]}>SECURE CONNECTION</Text>
          <View style={[styles.badgeDot, { backgroundColor: theme.primary }]} />
        </Animated.View>
      </View>
    </View>
  );
};

const LOGO_SIZE = 120;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Background layers ──────────────────────────────────────────────────────
  bgLayer1: {
    position: 'absolute',
    width: W * 1.4,
    height: W * 1.4,
    borderRadius: W * 0.7,
    top: -W * 0.3,
    left: -W * 0.2,
  },
  bgLayer2: {
    position: 'absolute',
    width: W * 1.2,
    height: W * 1.2,
    borderRadius: W * 0.6,
    bottom: -W * 0.4,
    right: -W * 0.3,
  },
  bgLayer3: {
    position: 'absolute',
    width: W * 0.8,
    height: W * 0.8,
    borderRadius: W * 0.4,
    top: H * 0.25,
    left: W * 0.1,
  },

  // ── Center ─────────────────────────────────────────────────────────────────
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  ringsWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: 300,
    height: 300,
  },

  glowHalo: {
    position: 'absolute',
    width: LOGO_SIZE + 60,
    height: LOGO_SIZE + 60,
    borderRadius: (LOGO_SIZE + 60) / 2,
  },

  logoWrap: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    borderRadius: LOGO_SIZE / 2,
    overflow: 'hidden',
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 12,
  },

  logo: {
    width: LOGO_SIZE - 12,
    height: LOGO_SIZE - 12,
    borderRadius: (LOGO_SIZE - 12) / 2,
  },

  scanLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 6,
  },

  title: {
    marginTop: 32,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: 1.5,
  },

  subtitle: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 3.5,
  },

  dotRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
  },
  dividerDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },

  // ── Bottom ─────────────────────────────────────────────────────────────────
  bottom: {
    width: '100%',
    paddingHorizontal: 40,
    paddingBottom: 52,
    alignItems: 'center',
    gap: 16,
  },

  progressTrack: {
    width: '100%',
    height: 3,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressShimmer: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 40,
    backgroundColor: 'rgba(255,255,255,0.4)',
    borderRadius: 2,
  },

  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badgeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2.5,
  },
});

export default LoadingScreen;
