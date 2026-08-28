import React, { useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Feather } from '@expo/vector-icons';

interface Props {
  visible: boolean;
  value: string; // HH:mm
  onConfirm: (time: string) => void;
  onCancel: () => void;
}

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

function parseTime(value: string) {
  const [hourPart, minutePart] = value.split(':');
  const hour = Number.parseInt(hourPart ?? '', 10);
  const minute = Number.parseInt(minutePart ?? '', 10);
  return {
    hour: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : 0,
    minute: Number.isInteger(minute) && minute >= 0 && minute <= 59 ? minute : 0,
  };
}

export default function TimePickerModal({ visible, value, onConfirm, onCancel }: Props) {
  const colors = useColors();
  const initialTime = parseTime(value);
  const [hour, setHour] = useState(pad(initialTime.hour));
  const [minute, setMinute] = useState(pad(initialTime.minute));
  const [timeError, setTimeError] = useState('');

  useEffect(() => {
    if (!visible) return;
    const nextTime = parseTime(value);
    setHour(pad(nextTime.hour));
    setMinute(pad(nextTime.minute));
    setTimeError('');
  }, [visible, value]);

  const changeHour = (d: number) => {
    setHour(current => {
      const currentNumber = Number.parseInt(current, 10);
      return pad(((Number.isInteger(currentNumber) ? currentNumber : 0) + d + 24) % 24);
    });
    setTimeError('');
  };
  const changeMinute = (d: number) => {
    setMinute(current => {
      const currentNumber = Number.parseInt(current, 10);
      return pad(((Number.isInteger(currentNumber) ? currentNumber : 0) + d + 60) % 60);
    });
    setTimeError('');
  };

  const handleConfirm = () => {
    const hourNumber = Number.parseInt(hour, 10);
    const minuteNumber = Number.parseInt(minute, 10);
    if (
      !Number.isInteger(hourNumber) || hourNumber < 0 || hourNumber > 23 ||
      !Number.isInteger(minuteNumber) || minuteNumber < 0 || minuteNumber > 59
    ) {
      setTimeError('Enter a valid time between 00:00 and 23:59.');
      return;
    }
    onConfirm(`${pad(hourNumber)}:${pad(minuteNumber)}`);
  };

  const s = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    container: { backgroundColor: colors.card, borderRadius: 20, padding: 24, width: 300, borderWidth: 1, borderColor: colors.border },
    title: { fontSize: 17, fontWeight: '700', color: colors.foreground, fontFamily: 'Inter_700Bold', textAlign: 'center', marginBottom: 24 },
    pickers: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    column: { alignItems: 'center', gap: 12 },
    arrow: { padding: 10, borderRadius: 10, backgroundColor: colors.secondary },
    valueBox: { width: 80, height: 70, borderRadius: 14, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
    valueInput: { width: 80, fontSize: 36, fontFamily: 'Inter_700Bold', color: colors.foreground, padding: 0, textAlign: 'center' },
    colon: { fontSize: 32, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, marginTop: -8 },
    label: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_500Medium' },
    error: { fontSize: 12, color: colors.destructive, fontFamily: 'Inter_500Medium', textAlign: 'center', marginTop: 12 },
    actions: { flexDirection: 'row', gap: 10, marginTop: 28 },
    btn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
    cancelBtn: { backgroundColor: colors.secondary },
    confirmBtn: { backgroundColor: colors.primary },
    cancelTxt: { color: colors.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 15 },
    confirmTxt: { color: colors.primaryForeground, fontFamily: 'Inter_600SemiBold', fontSize: 15 },
  });

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <Pressable style={s.overlay} onPress={onCancel}>
        <Pressable onPress={() => {}} style={s.container}>
          <Text style={s.title}>Select Time</Text>
          <View style={s.pickers}>
            <View style={s.column}>
              <TouchableOpacity style={s.arrow} onPress={() => changeHour(1)}>
                <Feather name="chevron-up" size={22} color={colors.foreground} />
              </TouchableOpacity>
              <View style={s.valueBox}>
                <TextInput
                  style={s.valueInput}
                  value={hour}
                  onChangeText={text => {
                    if (/^\d{0,2}$/.test(text)) {
                      setHour(text);
                      setTimeError('');
                    }
                  }}
                  keyboardType="number-pad"
                  maxLength={2}
                  selectTextOnFocus
                  accessibilityLabel="Hour"
                />
              </View>
              <TouchableOpacity style={s.arrow} onPress={() => changeHour(-1)}>
                <Feather name="chevron-down" size={22} color={colors.foreground} />
              </TouchableOpacity>
              <Text style={s.label}>HOUR</Text>
            </View>

            <Text style={s.colon}>:</Text>

            <View style={s.column}>
              <TouchableOpacity style={s.arrow} onPress={() => changeMinute(1)}>
                <Feather name="chevron-up" size={22} color={colors.foreground} />
              </TouchableOpacity>
              <View style={s.valueBox}>
                <TextInput
                  style={s.valueInput}
                  value={minute}
                  onChangeText={text => {
                    if (/^\d{0,2}$/.test(text)) {
                      setMinute(text);
                      setTimeError('');
                    }
                  }}
                  keyboardType="number-pad"
                  maxLength={2}
                  selectTextOnFocus
                  accessibilityLabel="Minute"
                />
              </View>
              <TouchableOpacity style={s.arrow} onPress={() => changeMinute(-1)}>
                <Feather name="chevron-down" size={22} color={colors.foreground} />
              </TouchableOpacity>
              <Text style={s.label}>MIN</Text>
            </View>
          </View>

          {timeError ? <Text style={s.error}>{timeError}</Text> : null}

          <View style={s.actions}>
            <TouchableOpacity style={[s.btn, s.cancelBtn]} onPress={onCancel}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btn, s.confirmBtn]}
              onPress={handleConfirm}
            >
              <Text style={s.confirmTxt}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
