import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Platform, Alert, Image, ActivityIndicator,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { useTracker } from '@/context/TrackerContext';
import DatePickerModal from '@/components/DatePickerModal';
import TimePickerModal from '@/components/TimePickerModal';
import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { enqueuePhotos } from '@/utils/photoUploadQueue';

const SERVER_URL_KEY = 'mechanic_server_url';

/** Upload a base64 image to the API server and return its hosted URL, or null on failure. */
async function uploadPhoto(base64: string, mimeType: string): Promise<string | null> {
  try {
    const storedUrl = await AsyncStorage.getItem(SERVER_URL_KEY);
    const apiBase = storedUrl?.trim() || '';
    if (!apiBase) return null;
    const res = await fetch(`${apiBase}/photos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: base64, mimeType }),
    });
    if (!res.ok) return null;
    const { url } = await res.json() as { url: string };
    // Resolve relative path against the server base (strip /api suffix for the origin)
    const origin = apiBase.replace(/\/api\/?$/, '');
    return `${origin}${url}`;
  } catch {
    return null;
  }
}

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
  const { addJob, updateJob, upsertVehicle, vehicles, jobs } = useTracker();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { jobId } = useLocalSearchParams<{ jobId?: string }>();
  const isEditMode = !!jobId;
  const editJob = isEditMode ? jobs.find(j => j.id === jobId) : undefined;
  // Tracks whether save was completed so the beforeRemove guard is skipped
  const savedRef = React.useRef(false);

  const [registration, setRegistration] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(nowTime());
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [isService, setIsService] = useState(false);
  const [mileageInput, setMileageInput] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  // photoUrls mirrors photos — same index maps to the server URL (or null if upload failed/pending)
  const [photoUrls, setPhotoUrls] = useState<(string | null)[]>([]);
  // photoBase64s mirrors photos — base64 kept in memory for queue fallback at save time
  const [photoBase64s, setPhotoBase64s] = useState<(string | null)[]>([]);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Pre-fill all fields when opening in edit mode (jobs load async from storage)
  const initializedRef = React.useRef(false);
  React.useEffect(() => {
    if (editJob && !initializedRef.current) {
      initializedRef.current = true;
      const vehicle = vehicles.find(v => v.registration === editJob.vehicleRegistration);
      setRegistration(editJob.vehicleRegistration);
      setMake(vehicle?.make ?? '');
      setModel(vehicle?.model ?? '');
      const [y, m, d] = editJob.date.split('-').map(Number);
      setSelectedDate(new Date(y ?? 2024, (m ?? 1) - 1, d ?? 1));
      setSelectedTime(editJob.time);
      setDescription(editJob.description);
      setNotes(editJob.notes);
      setIsService(editJob.isService);
      setMileageInput(editJob.mileageAtService?.toString() ?? '');
      setPhotos(editJob.photos ?? []);
      // Restore existing server URLs (nulls for any that weren't uploaded)
      const urls = editJob.photos?.map((_, i) => editJob.photoUrls?.[i] ?? null) ?? [];
      setPhotoUrls(urls);
    }
  }, [editJob, vehicles]);

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

  // Dirty detection — compare live state to the original job (edit mode) or to blank (add mode)
  const isDirty = isEditMode
    ? (initializedRef.current && editJob != null && (
        toISODate(selectedDate) !== editJob.date ||
        selectedTime !== editJob.time ||
        description.trim() !== editJob.description ||
        notes.trim() !== editJob.notes ||
        isService !== editJob.isService ||
        (mileageInput.trim() ? parseInt(mileageInput.trim(), 10) : undefined) !== editJob.mileageAtService ||
        photos.join('|') !== (editJob.photos ?? []).join('|')
      ))
    : (regUpper.length > 0 || description.trim().length > 0 || notes.trim().length > 0 || photos.length > 0);

  // Single navigation guard — covers × button, Android hardware back, and iOS swipe-to-dismiss
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (!isDirty || savedRef.current) return;
      e.preventDefault();
      Alert.alert(
        'Discard changes?',
        isEditMode
          ? "Your edits haven't been saved. Go back anyway?"
          : "You have unsaved work. Go back anyway?",
        [
          { text: 'Keep Editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
        ]
      );
    });
    return unsubscribe;
  }, [navigation, isDirty, isEditMode]);

  const handleSave = () => {
    if (!regUpper && !isEditMode) {
      Alert.alert('Required', 'Please enter a vehicle registration.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Required', 'Please describe the work done.');
      return;
    }
    const mileage = mileageInput.trim() ? parseInt(mileageInput.trim(), 10) : undefined;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    savedRef.current = true;

    // Collect non-null server URLs to sync to desktop
    const syncedUrls = photoUrls.filter((u): u is string => u !== null);

    if (isEditMode && jobId && editJob) {
      updateJob(jobId, {
        date: toISODate(selectedDate),
        time: selectedTime,
        description: description.trim(),
        notes: notes.trim(),
        isService,
        mileageAtService: mileage,
        photos:    photos.length    > 0 ? photos    : undefined,
        photoUrls: syncedUrls.length > 0 ? syncedUrls : undefined,
      });
      if (mileage !== undefined) {
        upsertVehicle(editJob.vehicleRegistration, '', '', mileage);
      }
      // Queue any photos whose upload failed so sync can retry them
      enqueuePhotos(
        photos
          .map((uri, i) => ({ uri, base64: photoBase64s[i] ?? null, url: photoUrls[i] }))
          .filter((p): p is { uri: string; base64: string; url: null } => !p.url && !!p.base64)
          .map(p => ({ jobId, uri: p.uri, base64: p.base64, mimeType: 'image/jpeg' }))
      );
    } else {
      upsertVehicle(regUpper, make.trim(), model.trim(), mileage);
      const newJob = addJob({
        vehicleRegistration: regUpper,
        date: toISODate(selectedDate),
        time: selectedTime,
        description: description.trim(),
        notes: notes.trim(),
        isService,
        ...(mileage !== undefined ? { mileageAtService: mileage } : {}),
        ...(photos.length    > 0 ? { photos }      : {}),
        ...(syncedUrls.length > 0 ? { photoUrls: syncedUrls } : {}),
      });
      // Queue any photos whose upload failed so sync can retry them
      enqueuePhotos(
        photos
          .map((uri, i) => ({ uri, base64: photoBase64s[i] ?? null, url: photoUrls[i] }))
          .filter((p): p is { uri: string; base64: string; url: null } => !p.url && !!p.base64)
          .map(p => ({ jobId: newJob.id, uri: p.uri, base64: p.base64, mimeType: 'image/jpeg' }))
      );
    }
    router.back();
  };

  const pickPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photo library to attach photos to jobs.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // quality 0.5 halves the JPEG payload vs the old 0.6 setting, keeping
      // the base64 body well within reverse-proxy size limits.
      quality: 0.5,
      base64: true,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      const asset  = result.assets[0];
      const localUri = asset.uri;
      const base64   = asset.base64 ?? null;

      // Add the photo locally first so the UI responds immediately
      const newIdx = photos.length;
      setPhotos(prev => [...prev, localUri]);
      setPhotoUrls(prev => [...prev, null]);
      setPhotoBase64s(prev => [...prev, base64]);

      // Attempt immediate upload if we have base64 — succeeds when the server
      // URL is already configured, silently stays null otherwise (queued at save).
      if (base64) {
        setUploadingIdx(newIdx);
        const hostedUrl = await uploadPhoto(base64, 'image/jpeg');
        setPhotoUrls(prev => {
          const next = [...prev];
          next[newIdx] = hostedUrl;
          return next;
        });
        setUploadingIdx(null);
      }
    }
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
    photoScroll: { marginTop: 4 },
    photoScrollContent: { gap: 8, paddingRight: 4 },
    photoThumbWrap: { position: 'relative' },
    photoThumb: { width: 80, height: 80, borderRadius: 10, backgroundColor: colors.secondary },
    photoUploadOverlay: {
      position: 'absolute', inset: 0,
      backgroundColor: 'rgba(0,0,0,0.45)',
      borderRadius: 10,
      alignItems: 'center', justifyContent: 'center',
    },
    photoSyncBadge: {
      position: 'absolute', bottom: 4, right: 4,
      backgroundColor: 'rgba(34,197,94,0.85)',
      borderRadius: 8, width: 18, height: 18,
      alignItems: 'center', justifyContent: 'center',
    },
    photoRemoveBtn: {
      position: 'absolute', top: -6, right: -6,
      backgroundColor: '#EF4444',
      borderRadius: 10, width: 20, height: 20,
      alignItems: 'center', justifyContent: 'center',
    },
    addPhotoBtn: {
      flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: colors.input,
      borderRadius: 12, borderWidth: 1, borderColor: colors.border,
      borderStyle: 'dashed',
      paddingHorizontal: 14, paddingVertical: 13,
    },
    addPhotoBtnText: { fontSize: 15, color: colors.primary, fontFamily: 'Inter_500Medium' },
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
        <Text style={s.headerTitle}>{isEditMode ? 'Edit Job' : 'Log Work'}</Text>
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
          {isEditMode ? (
            /* Locked in edit mode — can't reassign a job to a different vehicle */
            <View style={[s.input, { opacity: 0.6, justifyContent: 'center' }]}>
              <Text style={[s.regInput, { color: colors.foreground }]}>{registration}</Text>
            </View>
          ) : (
            <TextInput
              style={[s.input, s.regInput]}
              value={registration}
              onChangeText={v => { setRegistration(v); setShowSuggestions(true); }}
              placeholder="e.g. ABC 123"
              placeholderTextColor={colors.mutedForeground}
              autoCapitalize="characters"
              returnKeyType="done"
            />
          )}
          {!isEditMode && showSuggestions && suggestions.length > 0 && (
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

        {/* Make & Model — hidden in edit mode (vehicle details edited separately) */}
        {!isEditMode && (
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
        )}

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
              placeholder="e.g. 45000 km"
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

        {/* Photos */}
        <View style={s.section}>
          <Text style={s.label}>Photos (optional)</Text>
          {photos.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={s.photoScroll}
              contentContainerStyle={s.photoScrollContent}
            >
              {photos.map((uri, i) => (
                <View key={i} style={s.photoThumbWrap}>
                  <Image source={{ uri }} style={s.photoThumb} resizeMode="cover" />
                  {/* Upload spinner overlay */}
                  {uploadingIdx === i && (
                    <View style={s.photoUploadOverlay}>
                      <ActivityIndicator size="small" color="#fff" />
                    </View>
                  )}
                  {/* Cloud sync indicator — shown when upload succeeded */}
                  {uploadingIdx !== i && photoUrls[i] && (
                    <View style={s.photoSyncBadge}>
                      <Feather name="cloud" size={10} color="#fff" />
                    </View>
                  )}
                  <TouchableOpacity
                    style={s.photoRemoveBtn}
                    onPress={() => {
                      setPhotos(prev => prev.filter((_, j) => j !== i));
                      setPhotoUrls(prev => prev.filter((_, j) => j !== i));
                    }}
                  >
                    <Feather name="x" size={12} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}
          {photos.length < 5 && (
            <TouchableOpacity style={s.addPhotoBtn} onPress={pickPhoto} activeOpacity={0.7}>
              <Feather name="camera" size={18} color={colors.primary} />
              <Text style={s.addPhotoBtnText}>
                {photos.length === 0 ? 'Add Photos' : 'Add Another'}
              </Text>
            </TouchableOpacity>
          )}
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
