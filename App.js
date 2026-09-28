import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView,
  Linking,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { WebView } from 'react-native-webview';
import { StatusBar } from 'expo-status-bar';

// Fallback addresses of the Pi hotspot (used when the QR only contains the SSID)
const DEFAULT_API_URL = 'http://10.42.0.1:5000';
const DEFAULT_STREAM_URL = 'http://10.42.0.1:8080/stream';

const SCREENS = { SCAN: 'SCAN', CONNECT: 'CONNECT', STREAM: 'STREAM' };

// Accepts:
//  1) JSON object:  {"ssid","password","apiUrl","streamUrl"}
//  2) JSON string:  "TunaRpi"            (SSID only -> default URLs)
//  3) Wi-Fi QR:     WIFI:S:TunaRpi;T:nopass;;
// Anything else returns null so the scanner keeps looking.
function parseQrData(rawInput) {
  if (typeof rawInput !== 'string') return null;
  const raw = rawInput.trim();

  try {
    const json = JSON.parse(raw);
    if (json && typeof json === 'object') {
      if (!json.ssid && !json.apiUrl && !json.streamUrl) return null;
      return {
        ssid: json.ssid ?? 'Unknown',
        password: json.password ?? '',
        apiUrl: json.apiUrl ?? DEFAULT_API_URL,
        streamUrl: json.streamUrl ?? DEFAULT_STREAM_URL,
      };
    }
    if (typeof json === 'string' && json.length > 0) {
      return {
        ssid: json,
        password: '',
        apiUrl: DEFAULT_API_URL,
        streamUrl: DEFAULT_STREAM_URL,
      };
    }
    return null;
  } catch (e) {
    // not JSON, fall through
  }

  if (raw.startsWith('WIFI:')) {
    const ssid = raw.match(/S:((?:\\.|[^;])*);/);
    const pass = raw.match(/P:((?:\\.|[^;])*);/);
    return {
      ssid: ssid ? ssid[1] : 'Unknown',
      password: pass ? pass[1] : '',
      apiUrl: DEFAULT_API_URL,
      streamUrl: DEFAULT_STREAM_URL,
    };
  }
  return null;
}

export default function App() {
  const [screen, setScreen] = useState(SCREENS.SCAN);
  const [connInfo, setConnInfo] = useState(null);
  const [lastRead, setLastRead] = useState('');
  const [permission, requestPermission] = useCameraPermissions();
  const [checkingApi, setCheckingApi] = useState(false);
  const scannedOnce = useRef(false);

  const handleBarcodeScanned = ({ data }) => {
    if (scannedOnce.current) return;
    const parsed = parseQrData(data);
    if (!parsed) {
      // Not our code: show what was read and keep scanning
      setLastRead(String(data).slice(0, 80));
      return;
    }
    scannedOnce.current = true;
    setLastRead('');
    setConnInfo(parsed);
    setScreen(SCREENS.CONNECT);
  };

  const openWifiSettings = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('App-Prefs:root=WIFI').catch(() => Linking.openSettings());
    } else {
      Linking.sendIntent('android.settings.WIFI_SETTINGS').catch(() =>
        Linking.openSettings()
      );
    }
  };

  const confirmConnectedAndGo = async () => {
    setCheckingApi(true);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    try {
      const res = await fetch(`${connInfo.apiUrl}/status`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error('Bad response');
      setScreen(SCREENS.STREAM);
    } catch (e) {
      Alert.alert(
        "Can't reach the Pi yet",
        `Make sure your phone is connected to "${connInfo.ssid}" (mobile data can interfere), then try again.\n\n${String(e.message || e)}`,
        [
          { text: 'Try Again', style: 'cancel' },
          { text: 'Continue Anyway', onPress: () => setScreen(SCREENS.STREAM) },
        ]
      );
    } finally {
      clearTimeout(timer);
      setCheckingApi(false);
    }
  };

  const restart = () => {
    scannedOnce.current = false;
    setConnInfo(null);
    setLastRead('');
    setScreen(SCREENS.SCAN);
  };

  // --- SCAN SCREEN ---------------------------------------------------------
  if (screen === SCREENS.SCAN) {
    if (!permission) {
      return (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      );
    }
    if (!permission.granted) {
      return (
        <SafeAreaView style={styles.center}>
          <Text style={styles.title}>Camera permission needed</Text>
          <Text style={styles.subtitle}>
            We need camera access to scan the Raspberry Pi's QR code.
          </Text>
          <TouchableOpacity style={styles.button} onPress={requestPermission}>
            <Text style={styles.buttonText}>Grant Permission</Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }
    return (
      <View style={styles.flex}>
        <StatusBar style="light" />
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={handleBarcodeScanned}
        />
        <View style={styles.scanOverlay} pointerEvents="none">
          <View style={styles.scanBox} />
          <Text style={styles.scanHint}>
            Point your camera at the QR code shown on the Raspberry Pi
          </Text>
          {!!lastRead && (
            <Text style={styles.scanWarn}>
              Ignored a different code: {lastRead}
            </Text>
          )}
        </View>
      </View>
    );
  }

  // --- CONNECT SCREEN ------------------------------------------------------
  if (screen === SCREENS.CONNECT) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.title}>Pi Found</Text>
        <View style={styles.card}>
          <Text style={styles.cardLabel}>Network</Text>
          <Text style={styles.cardValue}>{connInfo.ssid}</Text>
          {!!connInfo.password && (
            <>
              <Text style={styles.cardLabel}>Password</Text>
              <Text style={styles.cardValue}>{connInfo.password}</Text>
            </>
          )}
          <Text style={styles.cardLabel}>API</Text>
          <Text style={styles.cardSmall}>{connInfo.apiUrl}</Text>
          <Text style={styles.cardLabel}>Stream</Text>
          <Text style={styles.cardSmall}>{connInfo.streamUrl}</Text>
        </View>
        <Text style={styles.subtitle}>
          Join this Wi-Fi network on your phone, then come back here.
        </Text>
        <TouchableOpacity style={styles.button} onPress={openWifiSettings}>
          <Text style={styles.buttonText}>Open Wi-Fi Settings</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.buttonPrimary]}
          onPress={confirmConnectedAndGo}
          disabled={checkingApi}
        >
          {checkingApi ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[styles.buttonText, styles.buttonTextLight]}>
              I'm Connected — View Camera
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={restart} style={styles.linkButton}>
          <Text style={styles.linkText}>Rescan QR code</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // --- STREAM SCREEN -------------------------------------------------------
  const streamHtml = `
    <html>
      <head><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
      <body style="margin:0;background:#000;">
        <img src="${connInfo.streamUrl}" style="width:100%;height:auto;display:block;" />
      </body>
    </html>
  `;
  return (
    <SafeAreaView style={styles.flex}>
      <StatusBar style="dark" />
      <View style={styles.streamHeader}>
        <Text style={styles.streamTitle}>Live Camera</Text>
        <TouchableOpacity onPress={restart}>
          <Text style={styles.linkText}>Rescan</Text>
        </TouchableOpacity>
      </View>
      <WebView
        source={{ html: streamHtml }}
        style={styles.flex}
        originWhitelist={['*']}
        mixedContentMode="always"
        startInLoadingState
        renderLoading={() => (
          <View style={styles.center}>
            <ActivityIndicator size="large" />
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#fff',
  },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#555', textAlign: 'center', marginBottom: 20 },
  button: {
    backgroundColor: '#eee',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginTop: 10,
    width: '100%',
    alignItems: 'center',
  },
  buttonPrimary: { backgroundColor: '#1f6feb' },
  buttonText: { fontSize: 16, fontWeight: '600', color: '#111' },
  buttonTextLight: { color: '#fff' },
  linkButton: { marginTop: 18 },
  linkText: { color: '#1f6feb', fontSize: 14, fontWeight: '600' },
  card: {
    width: '100%',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardLabel: { fontSize: 12, color: '#888', marginTop: 6 },
  cardValue: { fontSize: 18, fontWeight: '600' },
  cardSmall: { fontSize: 13, color: '#333' },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanBox: {
    width: 260,
    height: 260,
    borderWidth: 3,
    borderColor: '#fff',
    borderRadius: 18,
    marginBottom: 20,
  },
  scanHint: {
    color: '#fff',
    textAlign: 'center',
    paddingHorizontal: 30,
    fontSize: 14,
  },
  scanWarn: {
    color: '#ffd166',
    textAlign: 'center',
    paddingHorizontal: 30,
    fontSize: 12,
    marginTop: 12,
  },
  streamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  streamTitle: { fontSize: 18, fontWeight: '700' },
});