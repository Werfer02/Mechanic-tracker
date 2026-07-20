import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { Vehicle, Job } from '@/context/TrackerContext';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(dateStr: string) {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${parseInt(d ?? '0', 10)} ${MONTHS_SHORT[parseInt(m ?? '1', 10) - 1]} ${y}`;
}

interface Props {
  vehicle: Vehicle;
  jobCount: number;
  lastJob: Job | null;
  lastServiceEntry: Job | null;
  onPress: () => void;
  onDelete: () => void;
}

export default function VehicleCard({ vehicle, jobCount, lastJob, lastServiceEntry, onPress, onDelete }: Props) {
  const colors = useColors();

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert(
      'Remove Vehicle',
      `Remove ${vehicle.registration} and all its job history?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: onDelete },
      ]
    );
  };

  const s = StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: colors.radius,
      padding: 16,
      marginBottom: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    row: { flexDirection: 'row', alignItems: 'center' },
    plate: {
      backgroundColor: '#FFF9C4',
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderWidth: 2,
      borderColor: '#E6D800',
    },
    plateText: {
      fontSize: 20,
      fontFamily: 'Inter_700Bold',
      color: '#1A1A00',
      letterSpacing: 2,
    },
    info: { flex: 1, marginLeft: 14 },
    makeModel: { fontSize: 14, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginBottom: 4 },
    statsRow: { flexDirection: 'row', gap: 14 },
    stat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    statText: { fontSize: 13, color: colors.mutedForeground, fontFamily: 'Inter_500Medium' },
    actions: { flexDirection: 'row', gap: 8, marginLeft: 8 },
    iconBtn: { padding: 6 },
    lastServiceRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
    lastServiceLabel: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_500Medium' },
    lastServiceValue: { fontSize: 12, color: colors.foreground, fontFamily: 'Inter_600SemiBold' },
    lastServiceDesc: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', flex: 1 },
    dot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.border },
  });

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.75}>
      <View style={s.row}>
        <View style={s.plate}>
          <Text style={s.plateText}>{vehicle.registration}</Text>
        </View>
        <View style={s.info}>
          {!!(vehicle.make || vehicle.model) && (
            <Text style={s.makeModel} numberOfLines={1}>
              {[vehicle.make, vehicle.model].filter(Boolean).join(' ')}
            </Text>
          )}
          <View style={s.statsRow}>
            <View style={s.stat}>
              <Feather name="tool" size={13} color={colors.primary} />
              <Text style={s.statText}>{jobCount} {jobCount === 1 ? 'job' : 'jobs'}</Text>
            </View>
          </View>
        </View>
        <View style={s.actions}>
          <TouchableOpacity style={s.iconBtn} onPress={handleDelete}>
            <Feather name="trash-2" size={17} color={colors.mutedForeground} />
          </TouchableOpacity>
          <Feather name="chevron-right" size={18} color={colors.mutedForeground} />
        </View>
      </View>

      {(lastJob || lastServiceEntry) && (
        <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border, gap: 6 }}>
          {lastJob && (
            <View style={s.lastServiceRow}>
              <Feather name="tool" size={12} color={colors.mutedForeground} />
              <Text style={s.lastServiceLabel}>Last work:</Text>
              <Text style={s.lastServiceValue}>{formatDate(lastJob.date)} · {lastJob.time}</Text>
              <View style={s.dot} />
              <Text style={s.lastServiceDesc} numberOfLines={1}>{lastJob.description}</Text>
            </View>
          )}
          {lastServiceEntry && (
            <View style={s.lastServiceRow}>
              <Feather name="clock" size={12} color={colors.primary} />
              <Text style={[s.lastServiceLabel, { color: colors.primary }]}>Last service:</Text>
              <Text style={[s.lastServiceValue, { color: colors.primary }]}>{formatDate(lastServiceEntry.date)} · {lastServiceEntry.time}</Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}
