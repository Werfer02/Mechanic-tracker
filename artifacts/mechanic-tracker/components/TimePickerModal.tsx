import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
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

export default function TimePickerModal({ visible, value, onConfirm, onCancel }: Props) {
  const colors = useColors();
  const [hour, setHour] = useState(() => parseInt(value.split(':')[0] ?? '8', 10));
  const [minute, setMinute] = useState(() => parseInt(value.split(':')[1] ?? '0', 10));

  const changeHour = (d: number) => setHour(h => (h + d + 24) % 24);
  const changeMinute = (d: number) => setMinute(m => (m + d + 60) % 60);

  const s = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    container: { backgroundColor: colors.card, borderRadius: 20, padding: 24, width: 300, borderWidth: 1, borderColor: colors.border },
    title: { fontSize: 17, fontWeight: '700', color: colors.foreground, fontFamily: 'Inter_700Bold', textAlign: 'center', marginBottom: 24 },
    pickers: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
    column: { alignItems: 'center', gap: 12 },
    arrow: { padding: 10, borderRadius: 10, backgroundColor: colors.secondary },
    valueBox: { width: 80, height: 70, borderRadius: 14, backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border },
    valueText: { fontSize: 36, fontFamily: 'Inter_700Bold', color: colors.foreground },
    colon: { fontSize: 32, fontFamily: 'Inter_700Bold', color: colors.mutedForeground, marginTop: -8 },
    label: { fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_500Medium' },
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
                <Text style={s.valueText}>{pad(hour)}</Text>
              </View>
              <TouchableOpacity style={s.arrow} onPress={() => changeHour(-1)}>
                <Feather name="chevron-down" size={22} color={colors.foreground} />
              </TouchableOpacity>
              <Text style={s.label}>HOUR</Text>
            </View>

            <Text style={s.colon}>:</Text>

            <View style={s.column}>
              <TouchableOpacity style={s.arrow} onPress={() => changeMinute(5)}>
                <Feather name="chevron-up" size={22} color={colors.foreground} />
              </TouchableOpacity>
              <View style={s.valueBox}>
                <Text style={s.valueText}>{pad(minute)}</Text>
              </View>
              <TouchableOpacity style={s.arrow} onPress={() => changeMinute(-5)}>
                <Feather name="chevron-down" size={22} color={colors.foreground} />
              </TouchableOpacity>
              <Text style={s.label}>MIN</Text>
            </View>
          </View>

          <View style={s.actions}>
            <TouchableOpacity style={[s.btn, s.cancelBtn]} onPress={onCancel}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.btn, s.confirmBtn]}
              onPress={() => onConfirm(`${pad(hour)}:${pad(minute)}`)}
            >
              <Text style={s.confirmTxt}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
