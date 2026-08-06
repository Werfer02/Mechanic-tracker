import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, Platform,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useTracker } from '@/context/TrackerContext';
import JobCard from '@/components/JobCard';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { getJobSortTime } from '@/utils/jobTime';

export default function JobsScreen() {
  const colors = useColors();
  const { jobs, deleteJob } = useTracker();
  const insets = useSafeAreaInsets();

  const sorted = [...jobs].sort((a, b) => {
    const da = getJobSortTime(a);
    const db = getJobSortTime(b);
    return db - da;
  });

  const handleAdd = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/add-job');
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: (Platform.OS === 'web' ? 67 : insets.top) + 12,
      paddingBottom: 14,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerLeft: { gap: 2 },
    headerTitle: { fontSize: 26, fontFamily: 'Inter_700Bold', color: colors.foreground },
    headerSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground },
    addBtn: {
      backgroundColor: colors.primary,
      width: 42, height: 42,
      borderRadius: 21,
      alignItems: 'center',
      justifyContent: 'center',
    },
    list: { flex: 1 },
    listContent: {
      padding: 16,
      paddingBottom: (Platform.OS === 'web' ? 34 : insets.bottom) + 100,
    },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingTop: 80 },
    emptyIcon: {
      width: 72, height: 72,
      borderRadius: 36,
      backgroundColor: colors.secondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    emptyTitle: { fontSize: 18, fontFamily: 'Inter_600SemiBold', color: colors.foreground },
    emptyDesc: { fontSize: 14, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, textAlign: 'center', paddingHorizontal: 40 },
  });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <View style={s.headerLeft}>
          <Text style={s.headerTitle}>Work Log</Text>
          <Text style={s.headerSub}>{sorted.length} {sorted.length === 1 ? 'entry' : 'entries'}</Text>
        </View>
        <TouchableOpacity style={s.addBtn} onPress={handleAdd}>
          <Feather name="plus" size={22} color={colors.primaryForeground} />
        </TouchableOpacity>
      </View>

      <FlatList
        style={s.list}
        contentContainerStyle={sorted.length === 0 ? { flex: 1 } : s.listContent}
        data={sorted}
        extraData={colors}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
           <JobCard
             job={item}
             onDelete={deleteJob}
             onEdit={id => router.push({ pathname: '/add-job', params: { jobId: id } })}
             showVehicle
           />
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <Feather name="tool" size={32} color={colors.mutedForeground} />
            </View>
            <Text style={s.emptyTitle}>No jobs yet</Text>
            <Text style={s.emptyDesc}>Tap the + button to log your first work entry</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
