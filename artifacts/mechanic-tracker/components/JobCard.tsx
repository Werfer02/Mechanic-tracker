import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { Job } from '@/context/TrackerContext';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDate(dateStr: string) {
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${parseInt(d ?? '0', 10)} ${MONTHS_SHORT[parseInt(m ?? '1', 10) - 1]} ${y}`;
}

interface Props {
  job: Job;
  onDelete?: (id: string) => void;
  showVehicle?: boolean;
}

export default function JobCard({ job, onDelete, showVehicle = true }: Props) {
  const colors = useColors();

  const handleDelete = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Alert.alert('Delete Job', 'Remove this work entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => onDelete?.(job.id),
      },
    ]);
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
    topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
    leftTop: { gap: 4 },
    dateTime: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dateText: { fontSize: 13, color: colors.mutedForeground, fontFamily: 'Inter_500Medium' },
    regBadge: {
      alignSelf: 'flex-start',
      backgroundColor: colors.primary + '22',
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: colors.primary + '55',
    },
    regText: { fontSize: 13, color: colors.primary, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
    deleteBtn: { padding: 4 },
    desc: { fontSize: 15, color: colors.foreground, fontFamily: 'Inter_500Medium', lineHeight: 22 },
    notes: { fontSize: 13, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 6, lineHeight: 19 },
    dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.mutedForeground },
  });

  return (
    <View style={s.card}>
      <View style={s.topRow}>
        <View style={s.leftTop}>
          <View style={s.dateTime}>
            <Feather name="calendar" size={13} color={colors.mutedForeground} />
            <Text style={s.dateText}>{formatDate(job.date)}</Text>
            <View style={s.dot} />
            <Feather name="clock" size={13} color={colors.mutedForeground} />
            <Text style={s.dateText}>{job.time}</Text>
          </View>
          {showVehicle && (
            <View style={s.regBadge}>
              <Text style={s.regText}>{job.vehicleRegistration}</Text>
            </View>
          )}
        </View>
        {onDelete && (
          <TouchableOpacity style={s.deleteBtn} onPress={handleDelete}>
            <Feather name="trash-2" size={17} color={colors.mutedForeground} />
          </TouchableOpacity>
        )}
      </View>
      <Text style={s.desc}>{job.description}</Text>
      {!!job.notes && <Text style={s.notes}>{job.notes}</Text>}
    </View>
  );
}
