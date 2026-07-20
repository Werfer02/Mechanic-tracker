import React, { useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useTracker } from '@/context/TrackerContext';
import JobCard from '@/components/JobCard';
import ConfirmModal from '@/components/ConfirmModal';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(dateStr: string) {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${parseInt(d ?? '0', 10)} ${MONTHS_SHORT[parseInt(m ?? '1', 10) - 1]} ${y}`;
}

export default function VehicleDetailScreen() {
  const { reg } = useLocalSearchParams<{ reg: string }>();
  const registration = decodeURIComponent(reg ?? '');
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { vehicles, jobs, deleteJob, deleteVehicle, getJobsForVehicle, getLastService, getLastServiceEntry } = useTracker();

  const vehicle = vehicles.find(v => v.registration === registration);
  const vehicleJobs = getJobsForVehicle(registration);
  const lastService = getLastService(registration);
  const lastServiceEntry = getLastServiceEntry(registration);

  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const handleDeleteVehicle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setConfirmingDelete(true);
  };

  const handleAddJob = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/add-job');
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: (Platform.OS === 'web' ? 67 : insets.top) + 8,
      paddingBottom: 0,
      paddingHorizontal: 20,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    backBtn: { padding: 4, marginLeft: -4 },
    headerActions: { flexDirection: 'row', gap: 8 },
    iconBtn: { padding: 8, borderRadius: 10, backgroundColor: colors.secondary },
    addBtn: { padding: 8, borderRadius: 10, backgroundColor: colors.primary },
    plateSection: { alignItems: 'center', paddingBottom: 20 },
    plate: {
      backgroundColor: '#FFF9C4',
      borderRadius: 10,
      paddingHorizontal: 20,
      paddingVertical: 10,
      borderWidth: 2,
      borderColor: '#E6D800',
      marginBottom: 8,
    },
    plateText: { fontSize: 28, fontFamily: 'Inter_700Bold', color: '#1A1A00', letterSpacing: 3 },
    makeModel: { fontSize: 15, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' },
    statsRow: { flexDirection: 'row', gap: 12, marginTop: 12 },
    statCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      gap: 4,
    },
    statValue: { fontSize: 20, fontFamily: 'Inter_700Bold', color: colors.foreground },
    statLabel: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_500Medium' },
    statsContainer: { paddingHorizontal: 20, paddingBottom: 16, paddingTop: 12 },
    sectionHeader: {
      paddingHorizontal: 20,
      paddingVertical: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    sectionTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: colors.mutedForeground, textTransform: 'uppercase', letterSpacing: 0.5 },
    listContent: {
      padding: 16,
      paddingBottom: (Platform.OS === 'web' ? 34 : insets.bottom) + 40,
    },
    empty: { alignItems: 'center', justifyContent: 'center', gap: 10, paddingTop: 48 },
    emptyText: { fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.mutedForeground },
    notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
    notFoundText: { fontSize: 16, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' },
  });

  if (!vehicle && vehicleJobs.length === 0) {
    return (
      <View style={s.container}>
        <View style={[s.header, { borderBottomWidth: 0 }]}>
          <View style={s.topRow}>
            <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
              <Feather name="arrow-left" size={24} color={colors.foreground} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={s.notFound}>
          <Feather name="alert-circle" size={40} color={colors.mutedForeground} />
          <Text style={s.notFoundText}>Vehicle not found</Text>
        </View>
      </View>
    );
  }

  const ListHeader = () => (
    <>
      <View style={s.header}>
        <View style={s.topRow}>
          <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
            <Feather name="arrow-left" size={24} color={colors.foreground} />
          </TouchableOpacity>
          <View style={s.headerActions}>
            <TouchableOpacity style={s.iconBtn} onPress={handleDeleteVehicle}>
              <Feather name="trash-2" size={18} color={colors.mutedForeground} />
            </TouchableOpacity>
            <TouchableOpacity style={s.addBtn} onPress={handleAddJob}>
              <Feather name="plus" size={18} color={colors.primaryForeground} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={s.plateSection}>
          <View style={s.plate}>
            <Text style={s.plateText}>{registration}</Text>
          </View>
          {!!(vehicle?.make || vehicle?.model) && (
            <Text style={s.makeModel}>{[vehicle?.make, vehicle?.model].filter(Boolean).join(' ')}</Text>
          )}
        </View>
      </View>

      <View style={s.statsContainer}>
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={s.statValue}>{vehicleJobs.length}</Text>
            <Text style={s.statLabel}>Total Jobs</Text>
          </View>
          <View style={s.statCard}>
            <Text style={s.statValue} numberOfLines={1} adjustsFontSizeToFit>
              {lastService ? formatDate(lastService.date) : '—'}
            </Text>
            <Text style={s.statLabel}>Last Work</Text>
          </View>
        </View>

        {lastServiceEntry ? (
          <View style={[s.statsRow, { marginTop: 8 }]}>
            <View style={[s.statCard, { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12,
              borderColor: colors.primary + '55', backgroundColor: colors.primary + '11' }]}>
              <Feather name="clock" size={20} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[s.statLabel, { color: colors.primary }]}>Last Full Service</Text>
                <Text style={[s.statValue, { fontSize: 15, color: colors.primary }]} numberOfLines={1} adjustsFontSizeToFit>
                  {formatDate(lastServiceEntry.date)} · {lastServiceEntry.time}
                </Text>
                {!!lastServiceEntry.description && (
                  <Text numberOfLines={1} style={{ fontSize: 12, color: colors.primary + 'AA',
                    fontFamily: 'Inter_400Regular', marginTop: 2 }}>
                    {lastServiceEntry.description}
                  </Text>
                )}
              </View>
            </View>
          </View>
        ) : (
          <View style={[s.statsRow, { marginTop: 8 }]}>
            <View style={[s.statCard, { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12,
              borderColor: colors.border, backgroundColor: colors.secondary }]}>
              <Feather name="clock" size={20} color={colors.mutedForeground} />
              <View>
                <Text style={s.statLabel}>Last Full Service</Text>
                <Text style={[s.statValue, { fontSize: 15 }]}>No service recorded</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Service History</Text>
      </View>
    </>
  );

  return (
    <View style={s.container}>
      <FlatList
        data={vehicleJobs}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <JobCard job={item} onDelete={deleteJob} showVehicle={false} />
        )}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={
          <View style={s.empty}>
            <Feather name="inbox" size={32} color={colors.mutedForeground} />
            <Text style={s.emptyText}>No jobs recorded yet</Text>
          </View>
        }
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
      />

      <ConfirmModal
        visible={confirmingDelete}
        title="Remove Vehicle"
        message={`Remove ${registration} and all ${vehicleJobs.length} job(s)? This cannot be undone.`}
        confirmLabel="Remove"
        onConfirm={() => { setConfirmingDelete(false); deleteVehicle(registration); router.back(); }}
        onCancel={() => setConfirmingDelete(false)}
      />
    </View>
  );
}
