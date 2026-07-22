import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Platform, Alert,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useTracker } from '@/context/TrackerContext';
import DatePickerModal from '@/components/DatePickerModal';
import TimePickerModal from '@/components/TimePickerModal';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function formatDisplayDate(d: Date) {
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function nowTime() {
  const n = new Date();
  return `${n.getHours().toString().padStart(2, '0')}:${n.getMinutes().toString().padStart(2, '0')}`;
}

export default function AddJobScreen() {
  const colors = useColors();
  const { addJob, upsertVehicle, vehicles } = useTracker();
  const insets = useSafeAreaInsets();

  const [registration, setRegistration] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(nowTime());
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [isService, setIsService] = useState(false);
  const [mileageInput, setMileageInput] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const regUpper = registration.toUpperCase().trim();

  const suggestions = vehicles.filter(v =>
    v.registration.includes(regUpper) && regUpper.length > 0 && v.registration !== regUpper
  ).slice(0, 5);

  const selectSuggestion = (v: typeof vehicles[0]) => {
    setRegistration(v.registration);
    setMake(v.make);
    setModel(v.model);
    setShowSuggestions(false);
  };

  const handleSave = () => {
    if (!regUpper) {
      Alert.alert('Required', 'Please enter a vehicle registration.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Required', 'Please describe the work done.');
      return;
    }
    const mileage = mileageInput.trim() ? parseInt(mileageInput.trim(), 10) : undefined;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    upsertVehicle(regUpper, make.trim(), model.trim(), mileage);
    addJob({
      vehicleRegistration: regUpper,
      date: toISODate(selectedDate),
      time: selectedTime,
      description: description.trim(),
      notes: notes.trim(),
      isService,
      ...(mileage !== undefined ? { mileageAtService: mileage } : {}),
    });
    router.back();
  };

  const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: (Platform.OS === 'web' ? 67 : insets.top) + 8,
      paddingBottom: 14,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerTitle: { fontSize: 19, fontFamily: 'Inter_700Bold', color: colors.foreground },
    closeBtn: { padding: 6 },
    saveBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: 18,
      paddingVertical: 9,
      borderRadius: 10,
    },
    saveBtnText: { color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold', fontSize: 15 },
    content: { padding: 20, gap: 20, paddingBottom: (Platform.OS === 'web' ? 34 : insets.bottom) + 40 },
    section: { gap: 8 },
    label: { fontSize: 13, color: colors.mutedForeground, fontFamily: 'Inter_500Medium', textTransform: 'uppercase', letterSpacing: 0.5 },
    input: {
      backgroundColor: colors.input,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 13,
      fontSize: 16,
      color: colors.foreground,
      fontFamily: 'Inter_400Regular',
    },
    regInput: { textTransform: 'uppercase', letterSpacing: 1, fontFamily: 'Inter_700Bold', fontSize: 18 },
    textArea: { minHeight: 90, textAlignVertical: 'top', paddingTop: 13 },
    row: { flexDirection: 'row', gap: 12 },
    halfSection: { flex: 1, gap: 8 },
    pickerBtn: {
      backgroundColor: colors.input,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 14,
      paddingVertical: 13,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    pickerText: { fontSize: 15, color: colors.foreground, fontFamily: 'Inter_500Medium', flex: 1 },
    suggestionsContainer: {
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      marginTop: -8,
    },
    suggestionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 12,
      gap: 10,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    suggestionReg: { fontSize: 15, fontFamily: 'Inter_700Bold', color: colors.foreground, letterSpacing: 0.5 },
    suggestionMM: { fontSize: 13, color: colors.mutedForeground, fontFamily: 'Inter_400Regular' },
    makeModelRow: { flexDirection: 'row', gap: 10 },
    makeInput: { flex: 1 },
    serviceToggleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: 16,
      paddingVertical: 14,
    },
    serviceToggleLeft: { gap: 2 },
    serviceToggleTitle: { fontSize: 15, fontFamily: 'Inter_600SemiBold', color: colors.foreground },
    serviceToggleSub: { fontSize: 12, fontFamily: 'Inter_400Regular', color: colors.mutedForeground },
    toggleTrack: {
      width: 50, height: 28,
      borderRadius: 14,
      justifyContent: 'center',
      paddingHorizontal: 3,
    },
    toggleThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  });

  return (
    <View style={s.container}>
      <View style={s.header}>
        <TouchableOpacity style={s.closeBtn} onPress={() => router.back()}>
          <Feather name="x" size={24} color={colors.foreground} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Log Work</Text>
        <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
          <Text style={s.saveBtnText}>Save</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAwareScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        bottomOffset={20}
      >
        {/* Vehicle Registration */}
        <View style={s.section}>
          <Text style={s.label}>Vehicle Registration</Text>
          <TextInput
            style={[s.input, s.regInput]}
            value={registration}
            onChangeText={v => { setRegistration(v); setShowSuggestions(true); }}
            placeholder="e.g. ABC 123"
            placeholderTextColor={colors.mutedForeground}
            autoCapitalize="characters"
            returnKeyType="done"
          />
          {showSuggestions && suggestions.length > 0 && (
            <View style={s.suggestionsContainer}>
              {suggestions.map((v, i) => (
                <TouchableOpacity
                  key={v.id}
                  style={[s.suggestionItem, i === suggestions.length - 1 && { borderBottomWidth: 0 }]}
                  onPress={() => selectSuggestion(v)}
                >
                  <Feather name="truck" size={16} color={colors.primary} />
                  <View>
                    <Text style={s.suggestionReg}>{v.registration}</Text>
                    {!!(v.make || v.model) && (
                      <Text style={s.suggestionMM}>{[v.make, v.model].filter(Boolean).join(' ')}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Make & Model */}
        <View style={s.row}>
          <View style={[s.section, { flex: 1 }]}>
            <Text style={s.label}>Make (optional)</Text>
            <TextInput
              style={s.input}
              value={make}
              onChangeText={setMake}
              placeholder="e.g. Toyota"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="words"
            />
          </View>
          <View style={[s.section, { flex: 1 }]}>
            <Text style={s.label}>Model (optional)</Text>
            <TextInput
              style={s.input}
              value={model}
              onChangeText={setModel}
              placeholder="e.g. Hilux"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="words"
            />
          </View>
        </View>

        {/* Date & Time */}
        <View style={s.row}>
          <View style={[s.section, { flex: 1 }]}>
            <Text style={s.label}>Date</Text>
            <TouchableOpacity style={s.pickerBtn} onPress={() => setShowDatePicker(true)}>
              <Feather name="calendar" size={17} color={colors.primary} />
              <Text style={s.pickerText}>{formatDisplayDate(selectedDate)}</Text>
            </TouchableOpacity>
          </View>
          <View style={[s.section, { flex: 1 }]}>
            <Text style={s.label}>Time</Text>
            <TouchableOpacity style={s.pickerBtn} onPress={() => setShowTimePicker(true)}>
              <Feather name="clock" size={17} color={colors.primary} />
              <Text style={s.pickerText}>{selectedTime}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Service Toggle */}
        <TouchableOpacity
          style={s.serviceToggleRow}
          onPress={() => { setIsService(v => !v); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
          activeOpacity={0.8}
        >
          <View style={s.serviceToggleLeft}>
            <Text style={s.serviceToggleTitle}>Full Service</Text>
            <Text style={s.serviceToggleSub}>Mark this entry as a scheduled service</Text>
          </View>
          <View style={[s.toggleTrack, { backgroundColor: isService ? colors.primary : colors.secondary }]}>
            <View style={[s.toggleThumb, { alignSelf: isService ? 'flex-end' : 'flex-start' }]} />
          </View>
        </TouchableOpacity>

        {/* Mileage at Service — only shown when Full Service is on */}
        {isService && (
          <View style={s.section}>
            <Text style={s.label}>Mileage at Service (optional)</Text>
            <TextInput
              style={s.input}
              value={mileageInput}
              onChangeText={v => setMileageInput(v.replace(/[^0-9]/g, ''))}
              placeholder="e.g. 45000"
              placeholderTextColor={colors.mutedForeground}
              keyboardType="numeric"
              returnKeyType="done"
            />
          </View>
        )}

        {/* Description */}
        <View style={s.section}>
          <Text style={s.label}>Work Done</Text>
          <TextInput
            style={[s.input, s.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the work performed..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={4}
          />
        </View>

        {/* Notes */}
        <View style={s.section}>
          <Text style={s.label}>Notes (optional)</Text>
          <TextInput
            style={[s.input, s.textArea]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Parts used, issues found, next steps..."
            placeholderTextColor={colors.mutedForeground}
            multiline
            numberOfLines={3}
          />
        </View>
      </KeyboardAwareScrollView>

      <DatePickerModal
        visible={showDatePicker}
        value={selectedDate}
        onConfirm={d => { setSelectedDate(d); setShowDatePicker(false); }}
        onCancel={() => setShowDatePicker(false)}
      />
      <TimePickerModal
        visible={showTimePicker}
        value={selectedTime}
        onConfirm={t => { setSelectedTime(t); setShowTimePicker(false); }}
        onCancel={() => setShowTimePicker(false)}
      />
    </View>
  );
}
