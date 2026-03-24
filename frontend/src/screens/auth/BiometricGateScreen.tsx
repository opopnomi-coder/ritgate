import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface BiometricGateScreenProps {
  loading: boolean;
  message?: string;
  onRetry: () => void;
  onUseLogin: () => void;
}

const BiometricGateScreen: React.FC<BiometricGateScreenProps> = ({
  loading,
  message,
  onRetry,
  onUseLogin,
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name="finger-print-outline" size={52} color="#0EA5E9" />
        </View>
        <Text style={styles.title}>Secure Access</Text>
        <Text style={styles.subtitle}>
          Authenticate with fingerprint or your device PIN/pattern/password.
        </Text>
        {!!message && <Text style={styles.message}>{message}</Text>}

        <TouchableOpacity style={styles.primaryBtn} onPress={onRetry} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.primaryBtnText}>Authenticate</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryBtn} onPress={onUseLogin} disabled={loading}>
          <Text style={styles.secondaryBtnText}>Use Login Instead</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
  iconWrap: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#475569', textAlign: 'center', lineHeight: 20, marginBottom: 14 },
  message: { fontSize: 13, color: '#DC2626', textAlign: 'center', marginBottom: 14, fontWeight: '600' },
  primaryBtn: { width: '100%', backgroundColor: '#0EA5E9', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { width: '100%', borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#CBD5E1' },
  secondaryBtnText: { color: '#334155', fontSize: 14, fontWeight: '600' },
});

export default BiometricGateScreen;

