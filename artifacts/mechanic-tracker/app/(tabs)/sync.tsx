import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput,
  ScrollView, Platform, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { useColors } from '@/hooks/useColors';
import { useTracker } from '@/context/TrackerContext';
import { useSyncRoom } from '@/hooks/useSyncRoom';

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

export default function SyncScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { vehicles, jobs, replaceData } = useTracker();
  const { code, status, lastSynced, errorMsg, createRoom, joinRoom, disconnect, sync } = useSyncRoom();

  const [joinCode, setJoinCode] = useState('');
  const [showJoin, setShowJoin] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSync = async () => {
    const result = await sync(vehicles, jobs);
    if (result) {
      await replaceData(result.vehicles as any, result.jobs as any);
    }
  };

  const handleCopy = async () => {
    await Clipboard.setStringAsync(code ?? '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const s = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 40,
    },
    header: {
      paddingTop: (Platform.OS === 'web' ? 67 : insets.top) + 12,
      paddingBottom: 20,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      marginBottom: 24,
    },
    title: {
      fontSize: 28,
      fontFamily: 'Inter_700Bold',
      color: colors.foreground,
    },
    subtitle: {
      fontSize: 14,
      fontFamily: 'Inter_400Regular',
      color: colors.mutedForeground,
      marginTop: 4,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
    },
    statusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 20,
    },
    statusDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    statusText: {
      fontSize: 13,
      fontFamily: 'Inter_600SemiBold',
    },
    codeRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 12,
      marginBottom: 8,
    },
    codeText: {
      fontSize: 38,
      fontFamily: 'Inter_700Bold',
      color: colors.foreground,
      letterSpacing: 8,
    },
    codeHint: {
      fontSize: 12,
      fontFamily: 'Inter_400Regular',
      color: colors.mutedForeground,
      textAlign: 'center',
      marginBottom: 20,
    },
    copyBtn: {
      padding: 8,
      borderRadius: 8,
      backgroundColor: colors.secondary,
    },
    syncBtn: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 8,
    },
    syncBtnText: {
      color: colors.primaryForeground,
      fontFamily: 'Inter_700Bold',
      fontSize: 16,
    },
    lastSyncedText: {
      fontSize: 12,
      color: colors.mutedForeground,
      fontFamily: 'Inter_400Regular',
      textAlign: 'center',
      marginTop: 12,
    },
    disconnectBtn: {
      marginTop: 16,
      alignItems: 'center',
      paddingVertical: 10,
    },
    disconnectText: {
      color: colors.mutedForeground,
      fontFamily: 'Inter_500Medium',
      fontSize: 13,
    },
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
    errorText: {
      color: colors.destructive,
      fontFamily: 'Inter_500Medium',
      fontSize: 13,
      flex: 1,
    },
    emptyIcon: {
      alignItems: 'center',
      marginBottom: 24,
      opacity: 0.35,
    },
    emptyTitle: {
      fontSize: 18,
      fontFamily: 'Inter_700Bold',
      color: colors.foreground,
      textAlign: 'center',
      marginBottom: 8,
    },
    emptySubtitle: {
      fontSize: 14,
      fontFamily: 'Inter_400Regular',
      color: colors.mutedForeground,
      textAlign: 'center',
      lineHeight: 21,
      marginBottom: 28,
    },
    primaryBtn: {
      backgroundColor: colors.primary,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
      marginBottom: 12,
    },
    primaryBtnText: {
      color: colors.primaryForeground,
      fontFamily: 'Inter_700Bold',
      fontSize: 16,
    },
    secondaryBtn: {
      backgroundColor: colors.secondary,
      borderRadius: 14,
      paddingVertical: 15,
      alignItems: 'center',
    },
    secondaryBtnText: {
      color: colors.foreground,
      fontFamily: 'Inter_600SemiBold',
      fontSize: 16,
    },
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
    statsRow: {
      flexDirection: 'row',
      gap: 10,
      marginBottom: 16,
    },
    statPill: {
      flex: 1,
      backgroundColor: colors.secondary,
      borderRadius: 10,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    statValue: {
      fontSize: 20,
      fontFamily: 'Inter_700Bold',
      color: colors.foreground,
    },
    statLabel: {
      fontSize: 11,
      fontFamily: 'Inter_400Regular',
      color: colors.mutedForeground,
      marginTop: 2,
    },
  });

  const isSyncing = status === 'syncing';

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.title}>Sync</Text>
        <Text style={s.subtitle}>Keep your mobile and desktop data in sync</Text>
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
              Create a sync room or join one from the desktop app.{'\n'}
              On the desktop, tap the code badge to show a QR code you can scan.
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

            {!showJoin ? (
              <>
                <TouchableOpacity
                  style={s.primaryBtn}
                  onPress={createRoom}
                  disabled={isSyncing}
                >
                  {isSyncing
                    ? <ActivityIndicator color={colors.primaryForeground} />
                    : <Text style={s.primaryBtnText}>Create Sync Room</Text>
                  }
                </TouchableOpacity>
                <TouchableOpacity style={s.secondaryBtn} onPress={() => setShowJoin(true)}>
                  <Text style={s.secondaryBtnText}>Join Existing Room</Text>
                </TouchableOpacity>
              </>
            ) : (
              <View style={s.card}>
                <Text style={[s.statLabel, { marginBottom: 8, fontSize: 13 }]}>
                  Enter the 6-character code from the desktop app:
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
                  onPress={() => joinRoom(joinCode)}
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
                Enter this code in the desktop app to connect,{'\n'}
                or scan the QR shown on the desktop screen.
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
                <Text style={s.lastSyncedText}>
                  Last synced {formatRelative(lastSynced)}
                </Text>
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
      </ScrollView>
    </View>
  );
}
