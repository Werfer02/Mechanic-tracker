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
  value: Date;
  onConfirm: (date: Date) => void;
  onCancel: () => void;
}

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function DatePickerModal({ visible, value, onConfirm, onCancel }: Props) {
  const colors = useColors();
  const [current, setCurrent] = useState(new Date(value));
  const [selected, setSelected] = useState(new Date(value));

  const year = current.getFullYear();
  const month = current.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => setCurrent(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrent(new Date(year, month + 1, 1));

  const isSelected = (day: number) =>
    selected.getFullYear() === year &&
    selected.getMonth() === month &&
    selected.getDate() === day;

  const isToday = (day: number) => {
    const t = new Date();
    return t.getFullYear() === year && t.getMonth() === month && t.getDate() === day;
  };

  const s = StyleSheet.create({
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    container: { backgroundColor: colors.card, borderRadius: 20, padding: 20, width: 320, borderWidth: 1, borderColor: colors.border },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    monthYear: { fontSize: 17, fontWeight: '700', color: colors.foreground, fontFamily: 'Inter_700Bold' },
    arrow: { padding: 8 },
    dayRow: { flexDirection: 'row', marginBottom: 6 },
    dayLabel: { flex: 1, textAlign: 'center', fontSize: 12, color: colors.mutedForeground, fontFamily: 'Inter_500Medium' },
    weekRow: { flexDirection: 'row', marginBottom: 4 },
    cell: { flex: 1, aspectRatio: 1, justifyContent: 'center', alignItems: 'center', borderRadius: 8 },
    cellText: { fontSize: 15, fontFamily: 'Inter_400Regular', color: colors.foreground },
    todayText: { color: colors.primary },
    selectedCell: { backgroundColor: colors.primary },
    selectedText: { color: colors.primaryForeground, fontFamily: 'Inter_700Bold' },
    actions: { flexDirection: 'row', gap: 10, marginTop: 16 },
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
          <View style={s.header}>
            <TouchableOpacity onPress={prevMonth} style={s.arrow}>
              <Feather name="chevron-left" size={22} color={colors.foreground} />
            </TouchableOpacity>
            <Text style={s.monthYear}>{MONTHS[month]} {year}</Text>
            <TouchableOpacity onPress={nextMonth} style={s.arrow}>
              <Feather name="chevron-right" size={22} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          <View style={s.dayRow}>
            {DAYS.map(d => <Text key={d} style={s.dayLabel}>{d}</Text>)}
          </View>

          {Array.from({ length: cells.length / 7 }, (_, row) => (
            <View key={row} style={s.weekRow}>
              {cells.slice(row * 7, row * 7 + 7).map((day, i) => (
                <TouchableOpacity
                  key={i}
                  style={[s.cell, day && isSelected(day) && s.selectedCell]}
                  onPress={() => day && setSelected(new Date(year, month, day))}
                  disabled={!day}
                >
                  {day ? (
                    <Text style={[
                      s.cellText,
                      isToday(day) && s.todayText,
                      isSelected(day) && s.selectedText,
                    ]}>
                      {day}
                    </Text>
                  ) : null}
                </TouchableOpacity>
              ))}
            </View>
          ))}

          <View style={s.actions}>
            <TouchableOpacity style={[s.btn, s.cancelBtn]} onPress={onCancel}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, s.confirmBtn]} onPress={() => onConfirm(selected)}>
              <Text style={s.confirmTxt}>Confirm</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
