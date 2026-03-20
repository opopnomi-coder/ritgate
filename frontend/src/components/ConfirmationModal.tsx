import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Easing,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

interface ConfirmationModalProps {
  visible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: string;
  icon?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  visible,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  confirmColor,
  icon = 'alert-circle-outline',
  onConfirm,
  onCancel,
}) => {
  const { theme } = useTheme();
  const resolvedConfirmColor = confirmColor ?? theme.error;
  const animation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      animation.setValue(0);
      Animated.spring(animation, {
        toValue: 1,
        tension: 60,
        friction: 8,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const dismiss = (cb: () => void) => {
    Animated.timing(animation, {
      toValue: 0,
      duration: 180,
      easing: Easing.ease,
      useNativeDriver: true,
    }).start(cb);
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={() => dismiss(onCancel)}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={() => dismiss(onCancel)}>
        <Animated.View
          style={[
            styles.container,
            { backgroundColor: theme.surface },
            {
              opacity: animation,
              transform: [{ scale: animation.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }],
            },
          ]}
        >
          {/* Icon */}
          <View style={[styles.iconWrap, { backgroundColor: resolvedConfirmColor + '18' }]}>
            <View style={[styles.iconInner, { backgroundColor: resolvedConfirmColor + '28' }]}>
              <Ionicons name={icon as any} size={34} color={resolvedConfirmColor} />
            </View>
          </View>

          {/* Text */}
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          <Text style={[styles.message, { color: theme.textSecondary }]}>{message}</Text>

          {/* Buttons */}
          <View style={styles.btnRow}>
            <TouchableOpacity
              style={[styles.btn, styles.cancelBtn, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
              onPress={() => dismiss(onCancel)}
              activeOpacity={0.75}
            >
              <Text style={[styles.cancelText, { color: theme.textSecondary }]}>{cancelText}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.confirmBtn, { backgroundColor: resolvedConfirmColor }]}
              onPress={() => dismiss(onConfirm)}
              activeOpacity={0.8}
            >
              <Ionicons name={icon as any} size={18} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={styles.confirmText}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  container: {
    width: '100%',
    maxWidth: 380,
    borderRadius: 28,
    paddingTop: 36,
    paddingHorizontal: 24,
    paddingBottom: 28,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 16,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconInner: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  message: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
    paddingHorizontal: 8,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  btn: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  cancelBtn: {
    borderWidth: 1.5,
  },
  confirmBtn: {
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '700',
  },
  confirmText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.3,
  },
});

export default ConfirmationModal;
