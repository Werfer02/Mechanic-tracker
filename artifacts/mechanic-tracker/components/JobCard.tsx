import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Modal, SafeAreaView } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { Job } from '@/context/TrackerContext';
import ConfirmModal from '@/components/ConfirmModal';

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
  onEdit?: (id: string) => void;
  showVehicle?: boolean;
}

export default function JobCard({ job, onDelete, onEdit, showVehicle = true }: Props) {
  const colors = useColors();
  const [confirming, setConfirming] = useState(false);
  const [viewPhoto, setViewPhoto] = useState<string | null>(null);

  const handleDeletePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setConfirming(true);
  };

  const handleConfirm = () => {
    setConfirming(false);
    onDelete?.(job.id);
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
    leftTop: { gap: 4, flex: 1 },
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
    serviceBadge: {
      alignSelf: 'flex-start',
      backgroundColor: '#22C55E22',
      borderRadius: 6,
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderWidth: 1,
      borderColor: '#22C55E55',
    },
    regText: { fontSize: 13, color: colors.primary, fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
    serviceText: { fontSize: 13, color: '#22C55E', fontFamily: 'Inter_700Bold', letterSpacing: 0.5 },
    deleteBtn: { padding: 4, marginLeft: 8 },
    desc: { fontSize: 15, color: colors.foreground, fontFamily: 'Inter_500Medium', lineHeight: 22 },
    notes: { fontSize: 13, color: colors.mutedForeground, fontFamily: 'Inter_400Regular', marginTop: 6, lineHeight: 19 },
    dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.mutedForeground },
    badgesRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
    photoRow: { marginTop: 10 },
    photoRowContent: { gap: 6 },
    photoThumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: colors.secondary },
    photoModal: { flex: 1, backgroundColor: '#000' },
    photoModalClose: { position: 'absolute', top: 16, right: 16, zIndex: 10, padding: 8, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 20 },
    photoFull: { flex: 1, width: '100%' },
  });

  return (
    <>
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
            <View style={s.badgesRow}>
              {showVehicle && (
                <View style={s.regBadge}>
                  <Text style={s.regText}>{job.vehicleRegistration}</Text>
                </View>
              )}
              {job.isService && (
                <View style={s.serviceBadge}>
                  <Text style={s.serviceText}>
                    SERVICE{job.mileageAtService !== undefined ? ` · ${job.mileageAtService.toLocaleString()} km` : ''}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 2 }}>
            {onEdit && (
              <TouchableOpacity style={s.deleteBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onEdit(job.id); }}>
                <Feather name="edit-2" size={16} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity style={s.deleteBtn} onPress={handleDeletePress}>
                <Feather name="trash-2" size={17} color={colors.mutedForeground} />
              </TouchableOpacity>
            )}
          </View>
        </View>
        <Text style={s.desc}>{job.description}</Text>
        {!!job.notes && <Text style={s.notes}>{job.notes}</Text>}
        {!!job.photos?.length && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={s.photoRow}
            contentContainerStyle={s.photoRowContent}
          >
            {job.photos.map((uri, i) => (
              <TouchableOpacity key={i} onPress={() => setViewPhoto(uri)} activeOpacity={0.85}>
                <Image source={{ uri }} style={s.photoThumb} resizeMode="cover" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
      </View>

      <ConfirmModal
        visible={confirming}
        title="Delete Job"
        message="Remove this work entry? This cannot be undone."
        confirmLabel="Delete"
        onConfirm={handleConfirm}
        onCancel={() => setConfirming(false)}
      />

      <Modal visible={!!viewPhoto} transparent={false} animationType="fade" onRequestClose={() => setViewPhoto(null)}>
        <SafeAreaView style={s.photoModal}>
          <TouchableOpacity style={s.photoModalClose} onPress={() => setViewPhoto(null)}>
            <Feather name="x" size={22} color="#fff" />
          </TouchableOpacity>
          {viewPhoto && (
            <Image source={{ uri: viewPhoto }} style={s.photoFull} resizeMode="contain" />
          )}
        </SafeAreaView>
      </Modal>
    </>
  );
}
