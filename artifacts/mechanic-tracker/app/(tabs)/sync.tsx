import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  ScrollView, Platform, ActivityIndicator, Modal, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useColors } from '@/hooks/useColors';
import { useTracker } from '@/context/TrackerContext';
import { useSyncRoom } from '@/hooks/useSyncRoom';
import { APP_VERSION } from '@/constants/version';

// ── Shared backup format ──────────────────────────────────────────────────────
// version 1: { version, exportedAt, app, vehicles[], jobs[] }
// Bump `version` only on breaking schema changes. Consumers should preserve
// unknown fields so data round-trips safely when new fields are added later.
export const BACKUP_VERSION = 1 as const;

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatRelative(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const d = new Date(isoString);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

/**
 * Parse a QR scan result.
 *
 * The desktop embeds both the API base and the room code in the QR when a
 * server URL is configured, e.g.:
 *   http://192.168.1.x:3001/api?code=ABC123
 *
 * This lets us auto-configure the server URL on mobile in a single scan.
 * We also handle the fallback formats:
 *   - plain 6-char code:  "ABC123"
 *   - URL with only code param (no server info): "https://example.com?code=ABC123"
 */
function parseQrScan(raw: string): { code: string | null; serverUrl: string | null } {
  const trimmed = raw.trim();
  // Plain 6-char alphanumeric code — no server URL info
  if (/^[A-Z0-9]{6}$/i.test(trimmed)) return { code: trimmed.toUpperCase(), serverUrl: null };
  // URL — extract code param and optionally infer the server URL from the URL itself
  try {
    const url = new URL(raw);
    const code = (
      url.searchParams.get('code') ||
      url.searchParams.get('syncCode') ||
      url.searchParams.get('sync_code')
    );
    if (!code || !/^[A-Z0-9]{6}$/i.test(code)) return { code: null, serverUrl: null };
    // The server URL is the scheme+host+pathname portion (without query/hash).
    // e.g. "http://192.168.1.x:3001/api?code=ABC123" → "http://192.168.1.x:3001/api"
    const serverUrl = `${url.origin}${url.pathname}`.replace(/\/+$/, '');
    return { code: code.toUpperCase(), serverUrl };
  } catch { /* not a valid URL */ }
  return { code: null, serverUrl: null };
}

// ── QR Scanner error boundary ─────────────────────────────────────────────────
// CameraView can throw a native error during mount (module not ready, permission
// race, etc.).  Without a local boundary the error bubbles to Expo Router's root
// boundary and crashes the whole screen.  This boundary catches it locally and
// calls onClose so the modal just dismisses instead of killing the app.

interface QRBoundaryProps { onClose: () => void; children: React.ReactNode }
interface QRBoundaryState { crashed: boolean }

class QRScannerBoundary extends React.Component<QRBoundaryProps, QRBoundaryState> {
  state: QRBoundaryState = { crashed: false };
  static getDerivedStateFromError(): QRBoundaryState { return { crashed: true }; }
  componentDidCatch(err: unknown) {
    console.error('[QRScanner] native error caught by boundary:', err);
    // Dismiss the modal on the next tick so we're not calling setState during render
    setTimeout(() => this.props.onClose(), 0);
  }
  render() {
    if (this.state.crashed) return null;
    return this.props.children;
  }
}

// ── QR Scanner ────────────────────────────────────────────────────────────────

interface QRScannerProps {
  onScanned: (rawQrData: string) => void;
  onClose: () => void;
}

function QRScanner({ onScanned, onClose }: QRScannerProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const scannedRef = useRef(false);

  function handleBarcode({ data }: { data: string }) {
    if (scannedRef.current) return;
    const { code } = parseQrScan(data);
    if (code) {
      scannedRef.current = true;
      onScanned(data); // pass raw data so parent can extract server URL too
    }
  }

  const overlayColor = 'rgba(0,0,0,0.6)';
  const frameSize = 240;

  return (
    <Modal animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>

        {/* Permission not granted yet */}
        {!permission?.granted ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 }}>
            <Feather name="camera-off" size={52} color="#8B8FA8" style={{ marginBottom: 20 }} />
            <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 18, marginBottom: 10, textAlign: 'center' }}>
              Camera Access Needed
            </Text>
            <Text style={{ color: '#8B8FA8', fontFamily: 'Inter_400Regular', fontSize: 14, textAlign: 'center', marginBottom: 28, lineHeight: 21 }}>
              Point the camera at the QR code shown on the desktop screen to connect automatically.
            </Text>
            {permission?.canAskAgain === false ? (
              <Text style={{ color: '#8B8FA8', fontSize: 13, textAlign: 'center' }}>
                Camera permission was denied. Please enable it in your device Settings.
              </Text>
            ) : (
              <TouchableOpacity
                onPress={requestPermission}
                style={{ backgroundColor: '#F97316', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 }}
              >
                <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 16 }}>Allow Camera</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onClose} style={{ marginTop: 20 }}>
              <Text style={{ color: '#8B8FA8', fontFamily: 'Inter_500Medium', fontSize: 14 }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flex: 1 }}>
            <CameraView
              style={{ flex: 1 }}
              facing="back"
              autofocus="on"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={handleBarcode}
            />

            {/* Dark overlay with transparent centre window */}
            <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
              {/* Top */}
              <View style={{ flex: 1, backgroundColor: overlayColor }} />
              {/* Middle row */}
              <View style={{ flexDirection: 'row', height: frameSize }}>
                <View style={{ flex: 1, backgroundColor: overlayColor }} />
                {/* Clear window */}
                <View style={{ width: frameSize, height: frameSize, borderRadius: 16, overflow: 'hidden' }}>
                  {/* Corner markers */}
                  {[['top', 'left'], ['top', 'right'], ['bottom', 'left'], ['bottom', 'right']].map(([v, h]) => (
                    <View key={`${v}${h}`} style={{
                      position: 'absolute',
                      [v]: 0, [h]: 0,
                      width: 28, height: 28,
                      borderColor: '#F97316',
                      borderTopWidth: v === 'top' ? 3 : 0,
                      borderBottomWidth: v === 'bottom' ? 3 : 0,
                      borderLeftWidth: h === 'left' ? 3 : 0,
                      borderRightWidth: h === 'right' ? 3 : 0,
                      borderTopLeftRadius: v === 'top' && h === 'left' ? 8 : 0,
                      borderTopRightRadius: v === 'top' && h === 'right' ? 8 : 0,
                      borderBottomLeftRadius: v === 'bottom' && h === 'left' ? 8 : 0,
                      borderBottomRightRadius: v === 'bottom' && h === 'right' ? 8 : 0,
                    }} />
                  ))}
                </View>
                <View style={{ flex: 1, backgroundColor: overlayColor }} />
              </View>
              {/* Bottom */}
              <View style={{ flex: 1, backgroundColor: overlayColor }} />
            </View>

            {/* UI chrome */}
            <View style={[StyleSheet.absoluteFillObject, { justifyContent: 'space-between', pointerEvents: 'box-none' }]}>
              {/* Header */}
              <View style={{ paddingTop: insets.top + 12, paddingHorizontal: 20, alignItems: 'center' }}>
                <Text style={{ color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 18, marginBottom: 6 }}>
                  Scan QR Code
                </Text>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center' }}>
                  Point the camera at the QR shown on the desktop screen
                </Text>
              </View>

              {/* Footer */}
              <View style={{ paddingBottom: insets.bottom + 32, alignItems: 'center' }}>
                <TouchableOpacity
                  onPress={onClose}
                  style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 50, paddingHorizontal: 32, paddingVertical: 13, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' }}
                >
                  <Text style={{ color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 15 }}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

// ── Main Sync Screen ──────────────────────────────────────────────────────────

export default function SyncScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { vehicles, jobs, syncVehicles, syncJobs, replaceData } = useTracker();
  const { code, status, lastSynced, errorMsg, serverUrl, setServerUrl, createRoom, joinRoom, disconnect, sync } = useSyncRoom();

  const [joinCode, setJoinCode] = useState('');
  const [showJoin, setShowJoin] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [copied, setCopied] = useState(false);

  // Local mirror of serverUrl for the text input (so edits don't call AsyncStorage on every keystroke)
  const [urlInput, setUrlInput] = useState('');
  const [urlSaved, setUrlSaved] = useState(false);
  useEffect(() => { setUrlInput(serverUrl); }, [serverUrl]);
  const handleSaveUrl = useCallback(async () => {
    await setServerUrl(urlInput);
    setUrlSaved(true);
    setTimeout(() => setUrlSaved(false), 2000);
  }, [urlInput, setServerUrl]);

  // Keep refs fresh so the polling interval always has current data
  // without restarting itself every time vehicles/jobs change.
  // Use syncVehicles/syncJobs (raw, includes tombstones) so deletions propagate.
  const vehiclesRef = useRef(syncVehicles);
  const jobsRef = useRef(syncJobs);
  useEffect(() => { vehiclesRef.current = syncVehicles; }, [syncVehicles]);
  useEffect(() => { jobsRef.current = syncJobs; }, [syncJobs]);

  // Use a ref for the in-flight guard — avoids the stale-closure bug where
  // `status` captured at effect-creation time is permanently 'syncing'.
  const isSyncingRef = useRef(false);

  // Auto-sync every 8 s while connected so the desktop receives updates
  // without anyone pressing a button.
  useEffect(() => {
    if (!code) return;
    const id = setInterval(async () => {
      if (isSyncingRef.current) return; // don't pile up concurrent syncs
      isSyncingRef.current = true;
      try {
        const result = await sync(vehiclesRef.current, jobsRef.current);
        if (result) await replaceData(result.vehicles as any, result.jobs as any);
      } finally {
        isSyncingRef.current = false;
      }
    }, 8000);
    return () => clearInterval(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]); // only restart when room changes, not on every render

  const handleSync = async () => {
    const result = await sync(syncVehicles, syncJobs);
    if (result) {
      await replaceData(result.vehicles as any, result.jobs as any);
    }
  };

  /** Join a room then immediately sync — passes the returned code directly to
   *  sync() so it doesn't read stale React state (which is still null). */
  const handleJoinAndSync = async (roomCode: string) => {
    const confirmedCode = await joinRoom(roomCode);
    if (confirmedCode) {
      const result = await sync(syncVehicles, syncJobs, confirmedCode);
      if (result) await replaceData(result.vehicles as any, result.jobs as any);
    }
  };

  /** Create a room then immediately push local data into it */
  const handleCreateAndSync = async () => {
    const newCode = await createRoom();
    if (newCode) {
      const result = await sync(syncVehicles, syncJobs, newCode);
      if (result) await replaceData(result.vehicles as any, result.jobs as any);
    }
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(code ?? '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExport = async () => {
    try {
      const backup = {
        version: BACKUP_VERSION,
        exportedAt: new Date().toISOString(),
        app: 'mechanic-tracker',
        vehicles: syncVehicles,
        jobs: syncJobs,
      };
      const json = JSON.stringify(backup, null, 2);
      const date = new Date().toISOString().slice(0, 10);
      // cacheDirectory / documentDirectory are runtime constants not typed in v57
      const FS = FileSystem as any;
      const cacheDir: string = FS.cacheDirectory ?? FS.documentDirectory ?? '';
      const uri = `${cacheDir}mechanic-backup-${date}.json`;
      await FS.writeAsStringAsync(uri, json, { encoding: FS.EncodingType.UTF8 });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/json',
        dialogTitle: 'Save your backup file',
        UTI: 'public.json',
      });
    } catch {
      Alert.alert('Export failed', 'Could not create the backup file.');
    }
  };

  const handleImport = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/json', 'text/plain', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const file = result.assets[0];
      const text = await (FileSystem as any).readAsStringAsync(file.uri, { encoding: (FileSystem as any).EncodingType?.UTF8 ?? 'utf8' });
      const data = JSON.parse(text);
      if (!data.version || !Array.isArray(data.vehicles) || !Array.isArray(data.jobs)) {
        Alert.alert('Invalid file', 'This does not appear to be a valid Mechanic Tracker backup.');
        return;
      }
      if (data.version > BACKUP_VERSION) {
        Alert.alert(
          'Newer format',
          `This backup was made with a newer version of the app (format v${data.version}). Some data may not be fully supported.`
        );
      }
      Alert.alert(
        'Import backup?',
        `Replace all current data with ${data.vehicles.filter((v: any) => !v._deleted).length} vehicles and ${data.jobs.filter((j: any) => !j._deleted).length} jobs from this backup?\n\nThis cannot be undone.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Import', style: 'destructive',
            onPress: async () => {
              await replaceData(data.vehicles, data.jobs);
              Alert.alert('Done', 'Backup imported successfully.');
            },
          },
        ]
      );
    } catch {
      Alert.alert('Import failed', 'Could not read the file. Make sure it is a valid JSON backup.');
    }
  };

  function handleScanned(rawQrData: string) {
    setShowScanner(false);
    const { code, serverUrl: scannedUrl } = parseQrScan(rawQrData);
    if (!code) return;
    // Auto-configure server URL from QR when the desktop embedded it
    if (scannedUrl) {
      setServerUrl(scannedUrl);   // persists to AsyncStorage
      setUrlInput(scannedUrl);    // reflects in the URL input field
    }
    setTimeout(() => handleJoinAndSync(code), 300);
  }

  const isSyncing = status === 'syncing';

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
    header: {
      paddingTop: (Platform.OS === 'web' ? 67 : insets.top) + 12,
      paddingBottom: 20,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      marginBottom: 24,
    },
    title: { fontSize: 28, fontFamily: 'Inter_700Bold', color: colors.foreground },
    subtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 4 },
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
    },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    statusText: { fontSize: 13, fontFamily: 'Inter_600SemiBold' },
    codeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 8 },
    codeText: { fontSize: 38, fontFamily: 'Inter_700Bold', color: colors.foreground, letterSpacing: 8 },
    codeHint: { fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center', marginBottom: 20 },
    copyBtn: { padding: 8, borderRadius: 8, backgroundColor: colors.secondary },
    syncBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
    },
    syncBtnText: { color: colors.primaryForeground, fontFamily: 'Inter_700Bold', fontSize: 16 },
    lastSyncedText: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', textAlign: 'center', marginTop: 12 },
    disconnectBtn: { marginTop: 16, alignItems: 'center', paddingVertical: 10 },
    disconnectText: { color: colors.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 13 },
    errorBox: {
      backgroundColor: colors.destructive + '22',
      borderRadius: 10,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.destructive + '55',
      marginBottom: 16,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
    },
    errorText: { color: colors.destructive, fontFamily: 'Inter_500Medium', fontSize: 13, flex: 1 },
    emptyIcon: { alignItems: 'center', marginBottom: 24, opacity: 0.35 },
    emptyTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', color: colors.foreground, textAlign: 'center', marginBottom: 8 },
    emptySubtitle: { fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center', lineHeight: 21, marginBottom: 28 },
    primaryBtn: { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginBottom: 12 },
    primaryBtnText: { color: colors.primaryForeground, fontFamily: 'Inter_700Bold', fontSize: 16 },
    secondaryBtn: { backgroundColor: colors.secondary, borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
    secondaryBtnText: { color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 16 },
    scanBtn: {
      backgroundColor: 'transparent',
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
      borderWidth: 1,
      borderColor: colors.primary,
      marginBottom: 12,
    },
    scanBtnText: { color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 16 },
    input: {
      backgroundColor: colors.input,
      borderRadius: 12,
      paddingHorizontal: 16,
      paddingVertical: 13,
      color: colors.foreground,
      fontFamily: 'Inter_700Bold',
      fontSize: 22,
      letterSpacing: 6,
      textAlign: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 12,
    },
    statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    statPill: {
      flex: 1,
      backgroundColor: colors.secondary,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statValue: { fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground },
    statLabel: { fontSize: 11, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 2 },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 12,
    },
    orText: {
      textAlign: 'center',
      color: colors.mutedForeground,
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      marginVertical: 10,
    },
  });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Sync</Text>
        <Text style={s.subtitle}>Keep your mobile and desktop data in sync</Text>
        <Text style={[s.lastSyncedText, { textAlign: 'center', marginTop: 6, opacity: 0.4 }]}>
          v{APP_VERSION}
        </Text>
      </View>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>

        {/* Error banner */}
        {status === 'error' && errorMsg && (
          <View style={s.errorBox}>
            <Feather name="alert-circle" size={16} color={colors.destructive} />
            <Text style={s.errorText}>{errorMsg}</Text>
          </View>
        )}

        {!code ? (
          /* ── Not connected ── */
          <>
            <View style={s.emptyIcon}>
              <Feather name="refresh-cw" size={64} color={colors.mutedForeground} />
            </View>
            <Text style={s.emptyTitle}>Connect to Desktop</Text>
            <Text style={s.emptySubtitle}>
              Scan the QR code shown on the desktop screen, or create / join a room manually.
            </Text>

            <View style={s.statsRow}>
              <View style={s.statPill}>
                <Text style={s.statValue}>{vehicles.length}</Text>
                <Text style={s.statLabel}>Vehicles</Text>
              </View>
              <View style={s.statPill}>
                <Text style={s.statValue}>{jobs.length}</Text>
                <Text style={s.statLabel}>Jobs</Text>
              </View>
            </View>

            {/* Primary: scan QR */}
            <TouchableOpacity style={s.scanBtn} onPress={() => setShowScanner(true)}>
              <Feather name="camera" size={18} color={colors.primary} />
              <Text style={s.scanBtnText}>Scan QR Code</Text>
            </TouchableOpacity>

            <Text style={s.orText}>or</Text>

            {!showJoin ? (
              <>
                <TouchableOpacity
                  style={s.primaryBtn}
                  onPress={handleCreateAndSync}
                  disabled={isSyncing}
                >
                  {isSyncing
                    ? <ActivityIndicator color={colors.primaryForeground} />
                    : <Text style={s.primaryBtnText}>Create Sync Room</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity style={s.secondaryBtn} onPress={() => setShowJoin(true)}>
                  <Text style={s.secondaryBtnText}>Enter Code Manually</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={s.card}>
                <Text style={[s.statLabel, { marginBottom: 8, fontSize: 13 }]}>
                  Enter the 6-character code from the desktop:
                </Text>
                <TextInput
                  style={s.input}
                  value={joinCode}
                  onChangeText={v => setJoinCode(v.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                  placeholder="XXXXXX"
                  placeholderTextColor={colors.mutedForeground}
                  maxLength={6}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  autoFocus
                />
                <TouchableOpacity
                  style={[s.primaryBtn, { marginBottom: 8 }]}
                  onPress={() => handleJoinAndSync(joinCode)}
                  disabled={joinCode.length < 6 || isSyncing}
                >
                  {isSyncing
                    ? <ActivityIndicator color={colors.primaryForeground} />
                    : <Text style={s.primaryBtnText}>Connect</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity style={s.secondaryBtn} onPress={() => setShowJoin(false)}>
                  <Text style={s.secondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : (
          /* ── Connected ── */
          <>
            <View style={s.card}>
              <View style={s.statusRow}>
                <View style={[s.statusDot, {
                  backgroundColor: status === 'ok' ? colors.success
                    : status === 'syncing' ? colors.primary
                    : colors.mutedForeground,
                }]} />
                <Text style={[s.statusText, {
                  color: status === 'ok' ? colors.success
                    : status === 'syncing' ? colors.primary
                    : colors.mutedForeground,
                }]}>
                  {status === 'syncing' ? 'Syncing…' : 'Connected'}
                </Text>
              </View>

              <View style={s.codeRow}>
                <Text style={s.codeText}>{code}</Text>
                <TouchableOpacity style={s.copyBtn} onPress={handleCopy}>
                  <Feather name={copied ? 'check' : 'copy'} size={18} color={copied ? colors.success : colors.mutedForeground} />
                </TouchableOpacity>
              </View>

              <Text style={s.codeHint}>
                Your sync room code — enter this on the desktop, or tap the QR badge in the desktop header to connect another device.
              </Text>

              <TouchableOpacity style={s.syncBtn} onPress={handleSync} disabled={isSyncing}>
                {isSyncing
                  ? <ActivityIndicator color={colors.primaryForeground} />
                  : <>
                    <Feather name="refresh-cw" size={18} color={colors.primaryForeground} />
                    <Text style={s.syncBtnText}>Sync Now</Text>
                  </>
                }
              </TouchableOpacity>

              {lastSynced && (
                <Text style={s.lastSyncedText}>Last synced {formatRelative(lastSynced)}</Text>
              )}

              <TouchableOpacity style={s.disconnectBtn} onPress={disconnect}>
                <Text style={s.disconnectText}>Disconnect</Text>
              </TouchableOpacity>
            </View>

            <View style={s.statsRow}>
              <View style={s.statPill}>
                <Text style={s.statValue}>{vehicles.length}</Text>
                <Text style={s.statLabel}>Vehicles</Text>
              </View>
              <View style={s.statPill}>
                <Text style={s.statValue}>{jobs.length}</Text>
                <Text style={s.statLabel}>Jobs</Text>
              </View>
            </View>
          </>
        )}
        {/* ── Backup: export / import ── */}
        <View style={[s.card, { marginTop: 8 }]}>
          <Text style={[s.statLabel, { fontSize: 12, marginBottom: 12, textTransform: 'uppercase', letterSpacing: 0.8 }]}>
            Backup &amp; Restore
          </Text>
          <TouchableOpacity
            style={[s.syncBtn, { marginBottom: 10 }]}
            onPress={handleExport}
          >
            <Feather name="download" size={16} color={colors.primaryForeground} />
            <Text style={s.syncBtnText}>Export Backup</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.syncBtn, { backgroundColor: colors.secondary }]}
            onPress={handleImport}
          >
            <Feather name="upload" size={16} color={colors.foreground} />
            <Text style={[s.syncBtnText, { color: colors.foreground }]}>Import Backup</Text>
          </TouchableOpacity>
          <Text style={[s.lastSyncedText, { marginTop: 10, textAlign: 'left', lineHeight: 18 }]}>
            Export saves all data to a .json file you can share or store anywhere.{'\n'}
            Import replaces all current data — backup first!
          </Text>
        </View>

        {/* ── Server URL config ── */}
        <View style={[s.card, { marginTop: 8 }]}>
          <Text style={[s.statLabel, { fontSize: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.8 }]}>
            API Server URL
          </Text>
          <TextInput
            style={[s.input, { fontSize: 14, letterSpacing: 0, textAlign: 'left', fontFamily: 'Inter_400Regular', marginBottom: 8 }]}
            value={urlInput}
            onChangeText={setUrlInput}
            placeholder="http://192.168.1.x:3001/api"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            returnKeyType="done"
            onSubmitEditing={handleSaveUrl}
          />
          <TouchableOpacity
            style={[s.syncBtn, { backgroundColor: urlSaved ? colors.success : colors.secondary }]}
            onPress={handleSaveUrl}
          >
            <Feather name={urlSaved ? 'check' : 'save'} size={16} color={urlSaved ? '#fff' : colors.foreground} />
            <Text style={[s.syncBtnText, { color: urlSaved ? '#fff' : colors.foreground }]}>
              {urlSaved ? 'Saved' : 'Save URL'}
            </Text>
          </TouchableOpacity>
          <Text style={[s.lastSyncedText, { marginTop: 10, textAlign: 'left', lineHeight: 18 }]}>
            Your local API server address. Required for syncing with the desktop app.{'\n'}
            Example: http://192.168.1.x:3001/api
          </Text>
        </View>

      </ScrollView>

      {/* QR Scanner modal — wrapped in a local error boundary so a native
          camera crash closes the modal instead of crashing the whole screen */}
      {showScanner && (
        <QRScannerBoundary onClose={() => setShowScanner(false)}>
          <QRScanner
            onScanned={handleScanned}
            onClose={() => setShowScanner(false)}
          />
        </QRScannerBoundary>
      )}
    </View>
  );
}
