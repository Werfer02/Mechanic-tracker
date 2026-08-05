import React from 'react';
import {
  View, Text, SectionList, StyleSheet, Platform, TouchableOpacity,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useTracker } from '@/context/TrackerContext';
import VehicleCard from '@/components/VehicleCard';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getJobSortTime } from '@/utils/jobTime';

export default function VehiclesScreen() {
  const colors = useColors();
  const { vehicles, jobs, deleteVehicle, getLastService, getLastServiceEntry } = useTracker();
  const insets = useSafeAreaInsets();
  const [collapsedOwners, setCollapsedOwners] = React.useState<Set<string>>(new Set());

  const sorted = [...vehicles].sort((a, b) => {
    const la = getLastService(a.registration);
    const lb = getLastService(b.registration);
    const da = la ? getJobSortTime(la) : 0;
    const db = lb ? getJobSortTime(lb) : 0;
    return db - da;
  });
  const sections = Array.from(
    sorted.reduce((groups, vehicle) => {
      const owner = vehicle.owner?.trim() || 'No owner';
      const group = groups.get(owner) ?? [];
      group.push(vehicle);
      groups.set(owner, group);
      return groups;
    }, new Map<string, typeof sorted>())
  )
    .sort(([a], [b]) => a === 'No owner' ? 1 : b === 'No owner' ? -1 : a.localeCompare(b))
    .map(([owner, data]) => ({
      owner,
      data: collapsedOwners.has(owner) ? [] : data,
      count: data.length,
    }));

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
    groupHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 8,
      borderRadius: 10,
      backgroundColor: colors.secondary,
      borderWidth: 1,
      borderColor: colors.border,
    },
    groupTitle: { fontSize: 14, fontFamily: 'Inter_700Bold', color: colors.foreground },
    groupCount: { fontSize: 12, fontFamily: 'Inter_500Medium', color: colors.mutedForeground },
  });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <Text style={s.headerTitle}>Vehicles</Text>
        <Text style={s.headerSub}>{vehicles.length} {vehicles.length === 1 ? 'vehicle' : 'vehicles'} tracked</Text>
      </View>

      <SectionList
        style={s.list}
        contentContainerStyle={vehicles.length === 0 ? { flex: 1 } : s.listContent}
        sections={sections}
        extraData={colors}
        keyExtractor={item => item.id}
        renderSectionHeader={({ section }) => (
          <TouchableOpacity
            style={s.groupHeader}
            onPress={() => setCollapsedOwners(prev => {
              const next = new Set(prev);
              if (next.has(section.owner)) next.delete(section.owner);
              else next.add(section.owner);
              return next;
            })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Feather
                name={collapsedOwners.has(section.owner) ? 'chevron-right' : 'chevron-down'}
                size={16}
                color={colors.primary}
              />
              <Text style={s.groupTitle}>{section.owner}</Text>
            </View>
            <Text style={s.groupCount}>{section.count} {section.count === 1 ? 'vehicle' : 'vehicles'}</Text>
          </TouchableOpacity>
        )}
        renderItem={({ item }) => (
          <VehicleCard
            vehicle={item}
            jobCount={jobs.filter(j => j.vehicleRegistration === item.registration).length}
            lastJob={getLastService(item.registration)}
            lastServiceEntry={getLastServiceEntry(item.registration)}
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
