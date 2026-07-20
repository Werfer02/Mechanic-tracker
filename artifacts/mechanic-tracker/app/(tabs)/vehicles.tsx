import React from 'react';
import {
  View, Text, FlatList, StyleSheet, Platform,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useTracker } from '@/context/TrackerContext';
import VehicleCard from '@/components/VehicleCard';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function VehiclesScreen() {
  const colors = useColors();
  const { vehicles, jobs, deleteVehicle, getLastService } = useTracker();
  const insets = useSafeAreaInsets();

  const sorted = [...vehicles].sort((a, b) => {
    const la = getLastService(a.registration);
    const lb = getLastService(b.registration);
    const da = la ? new Date(`${la.date}T${la.time}`).getTime() : 0;
    const db = lb ? new Date(`${lb.date}T${lb.time}`).getTime() : 0;
    return db - da;
  });

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingTop: (Platform.OS === 'web' ? 67 : insets.top) + 12,
      paddingBottom: 14,
      paddingHorizontal: 20,
      backgroundColor: colors.background,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: { fontSize: 26, fontFamily: 'Inter_700Bold', color: colors.foreground },
    headerSub: { fontSize: 13, fontFamily: 'Inter_400Regular', color: colors.mutedForeground, marginTop: 2 },
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
        <Text style={s.headerTitle}>Vehicles</Text>
        <Text style={s.headerSub}>{vehicles.length} {vehicles.length === 1 ? 'vehicle' : 'vehicles'} tracked</Text>
      </View>

      <FlatList
        style={s.list}
        contentContainerStyle={sorted.length === 0 ? { flex: 1 } : s.listContent}
        data={sorted}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <VehicleCard
            vehicle={item}
            jobCount={jobs.filter(j => j.vehicleRegistration === item.registration).length}
            lastJob={getLastService(item.registration)}
            onPress={() => router.push(`/vehicle/${encodeURIComponent(item.registration)}`)}
            onDelete={() => deleteVehicle(item.registration)}
          />
        )}
        ListEmptyComponent={
          <View style={s.empty}>
            <View style={s.emptyIcon}>
              <Feather name="truck" size={32} color={colors.mutedForeground} />
            </View>
            <Text style={s.emptyTitle}>No vehicles yet</Text>
            <Text style={s.emptyDesc}>Vehicles appear here automatically when you log work</Text>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}
