import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Camera, CameraView } from 'expo-camera';
import { THEME } from '../../config/api.config';
import ErrorModal from '../../components/ErrorModal';

interface QRLoginScannerProps {
  onScanSuccess: (qrData: string) => void;
  onClose: () => void;
}

const QRLoginScanner: React.FC<QRLoginScannerProps> = ({ onScanSuccess, onClose }) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scanned, setScanned] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    requestCameraPermission();
  }, []);

  const requestCameraPermission = async () => {
    try {
      const { status } = await Camera.requestCameraPermissionsAsync();
      setHasPermission(status === 'granted');
      
      if (status !== 'granted') {
        setErrorMessage('Please grant camera permission in your device settings to scan QR codes for login.');
        setShowErrorModal(true);
      }
    } catch (error) {
      console.error('Error requesting camera permission:', error);
      setErrorMessage('Failed to request camera permission');
      setShowErrorModal(true);
      onClose();
    }
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned || scanning) return;
    
    setScanned(true);
    setScanning(true);
    
    if (!data || data.trim().length === 0) {
      setErrorMessage('The scanned QR code is empty');
      setShowErrorModal(true);
      setScanned(false);
      setScanning(false);
      return;
    }

    onScanSuccess(data);
  };

  const handleRescan = () => {
    setScanned(false);
    setScanning(false);
  };

  if (hasPermission === null) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#1E293B" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.colors.primary} />
          <Text style={styles.loadingText}>Requesting camera permission...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (hasPermission === false) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#1E293B" />
        <View style={styles.errorContainer}>
          <Ionicons name="close-circle" size={64} color="#EF4444" />
          <Text style={styles.errorTitle}>Camera Access Denied</Text>
          <Text style={styles.errorText}>
            Camera permission is required to scan QR codes for login.
          </Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <StatusBar barStyle="light-content" backgroundColor="#1E293B" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onClose}>
          <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan QR/Barcode</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Camera View */}
      <View style={styles.cameraContainer}>
        <CameraView
          style={styles.camera}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: [
              'qr',
              'ean13',
              'ean8',
              'code128',
              'code39',
              'code93',
              'upc_e',
              'pdf417',
              'aztec',
              'datamatrix',
              'itf14',
            ],
          }}
        />
        
        {/* Scanning Overlay */}
        <View style={styles.overlay}>
          <View style={styles.scanArea}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
          </View>
        </View>

        {/* Instructions */}
        <View style={styles.instructionsContainer}>
          <View style={styles.instructionsBadge}>
            <Ionicons name="qr-code" size={24} color="#FFFFFF" />
            <Text style={styles.instructionsText}>
              {scanned ? 'Processing...' : 'Position QR code or barcode within the frame'}
            </Text>
          </View>
        </View>

        {/* Rescan Button */}
        {scanned && (
          <View style={styles.rescanContainer}>
            <TouchableOpacity style={styles.rescanButton} onPress={handleRescan}>
              <Ionicons name="refresh" size={20} color="#FFFFFF" />
              <Text style={styles.rescanText}>Scan Again</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <ErrorModal
        visible={showErrorModal}
        type="general"
        message={errorMessage}
        onClose={() => setShowErrorModal(false)}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E293B',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#94A3B8',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  closeButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: THEME.colors.primary,
    borderRadius: 8,
  },
  closeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: '#1E293B',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  placeholder: {
    width: 40,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 250,
    height: 250,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderColor: '#FFFFFF',
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
  },
  instructionsContainer: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  instructionsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(30, 41, 59, 0.9)',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderRadius: 12,
    marginHorizontal: 24,
  },
  instructionsText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  rescanContainer: {
    position: 'absolute',
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  rescanButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  rescanText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  infoSection: {
    padding: 16,
    backgroundColor: '#1E293B',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#334155',
    padding: 16,
    borderRadius: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#CBD5E1',
    lineHeight: 18,
  },
});

export default QRLoginScanner;
