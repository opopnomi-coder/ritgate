/**
 * ActionLockContext
 * -----------------
 * Global UI lock used during critical API operations (Submit / Approve / Reject).
 * When locked:
 *   - All navigation is blocked (back button, swipe, hardware back)
 *   - A full-screen overlay is shown with a status message
 *   - No duplicate API calls can be triggered
 */
import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Modal } from 'react-native';

interface ActionLockContextType {
  isLocked: boolean;
  lockMessage: string;
  lock: (message?: string) => void;
  unlock: () => void;
  /** Wrap an async action — auto locks before, unlocks after */
  withLock: <T>(fn: () => Promise<T>, message?: string) => Promise<T>;
  /** Silent swipe-only lock — blocks SwipeBackWrapper without showing overlay */
  swipeLocked: boolean;
  lockSwipe: () => void;
  unlockSwipe: () => void;
}

const ActionLockContext = createContext<ActionLockContextType | undefined>(undefined);

export const ActionLockProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isLocked, setIsLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState('Processing...');
  const [swipeLocked, setSwipeLocked] = useState(false);

  const lock = useCallback((message = 'Processing...') => {
    setLockMessage(message);
    setIsLocked(true);
    (global as any).__actionLocked = true;
  }, []);

  const unlock = useCallback(() => {
    setIsLocked(false);
    setLockMessage('Processing...');
    (global as any).__actionLocked = false;
  }, []);

  const lockSwipe = useCallback(() => setSwipeLocked(true), []);
  const unlockSwipe = useCallback(() => setSwipeLocked(false), []);

  const withLock = useCallback(async <T,>(fn: () => Promise<T>, message = 'Processing...'): Promise<T> => {
    lock(message);
    try {
      return await fn();
    } finally {
      unlock();
    }
  }, [lock, unlock]);

  return (
    <ActionLockContext.Provider value={{ isLocked, lockMessage, lock, unlock, withLock, swipeLocked, lockSwipe, unlockSwipe }}>
      {children}
      {/* Full-screen overlay — rendered at top level so it covers everything */}
      <Modal
        visible={isLocked}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => { /* intentionally blocked */ }}
      >
        <View style={styles.overlay}>
          <View style={styles.card}>
            <ActivityIndicator size="large" color="#00B4D8" style={styles.spinner} />
            <Text style={styles.message}>{lockMessage}</Text>
            <Text style={styles.subtext}>Please wait...</Text>
          </View>
        </View>
      </Modal>
    </ActionLockContext.Provider>
  );
};

export const useActionLock = (): ActionLockContextType => {
  const ctx = useContext(ActionLockContext);
  if (!ctx) throw new Error('useActionLock must be used within ActionLockProvider');
  return ctx;
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 32,
    paddingHorizontal: 40,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
    minWidth: 220,
  },
  spinner: {
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtext: {
    fontSize: 13,
    color: '#9CA3AF',
    fontWeight: '500',
  },
});
