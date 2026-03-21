import React, { useRef } from 'react';
import { Animated, Dimensions, StyleSheet } from 'react-native';
import {
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
  State,
} from 'react-native-gesture-handler';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const EDGE_HIT_SLOP = 30;
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.35;
const VELOCITY_THRESHOLD = 600;

interface SwipeBackWrapperProps {
  children: React.ReactNode;
  onBack: () => void;
  /** Disable on root screens */
  enabled?: boolean;
  /** Disable during API calls / locked state */
  locked?: boolean;
}

const SwipeBackWrapper: React.FC<SwipeBackWrapperProps> = ({
  children,
  onBack,
  enabled = true,
  locked = false,
}) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const startedFromEdge = useRef(false);
  // Prevent double-trigger
  const navigating = useRef(false);

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: translateX } }],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = (event: PanGestureHandlerGestureEvent) => {
    // Hard block when locked or disabled
    if (!enabled || locked) {
      translateX.setValue(0);
      return;
    }

    const { state, translationX, velocityX, x } = event.nativeEvent;

    if (state === State.BEGAN) {
      startedFromEdge.current = x <= EDGE_HIT_SLOP;
      navigating.current = false;
    }

    if (state === State.ACTIVE) {
      if (!startedFromEdge.current || translationX < 0) {
        translateX.setValue(0);
      }
    }

    if (state === State.END || state === State.FAILED || state === State.CANCELLED) {
      const shouldNavigate =
        !navigating.current &&
        startedFromEdge.current &&
        (translationX >= SWIPE_THRESHOLD || velocityX >= VELOCITY_THRESHOLD);

      if (shouldNavigate) {
        navigating.current = true;
        Animated.timing(translateX, {
          toValue: SCREEN_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          translateX.setValue(0);
          navigating.current = false;
          onBack();
        });
      } else {
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
          bounciness: 0,
          speed: 20,
        }).start();
      }
      startedFromEdge.current = false;
    }
  };

  if (!enabled) {
    return <>{children}</>;
  }

  const clampedTranslate = translateX.interpolate({
    inputRange: [0, SCREEN_WIDTH],
    outputRange: [0, SCREEN_WIDTH],
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const shadowOpacity = translateX.interpolate({
    inputRange: [0, SCREEN_WIDTH * 0.5],
    outputRange: [0, 0.15],
    extrapolate: 'clamp',
  });

  return (
    <PanGestureHandler
      onGestureEvent={onGestureEvent}
      onHandlerStateChange={onHandlerStateChange}
      activeOffsetX={[0, 25]}
      failOffsetY={[-15, 15]}
      enabled={!locked}
    >
      <Animated.View
        style={[styles.container, { transform: [{ translateX: clampedTranslate }] }]}
      >
        {children}
        <Animated.View
          pointerEvents="none"
          style={[styles.edgeShadow, { opacity: shadowOpacity }]}
        />
      </Animated.View>
    </PanGestureHandler>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  edgeShadow: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
});

export default SwipeBackWrapper;
