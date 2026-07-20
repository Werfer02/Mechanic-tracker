import React from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet, Pressable,
} from 'react-native';
import { useColors } from '@/hooks/useColors';

interface Props {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  visible, title, message, confirmLabel = 'Delete', onConfirm, onCancel,
}: Props) {
  const colors = useColors();

  const s = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 32,
    },
    container: {
      backgroundColor: colors.card,
      borderRadius: 20,
      padding: 24,
      width: '100%',
      maxWidth: 320,
      borderWidth: 1,
      borderColor: colors.border,
    },
    title: {
      fontSize: 17,
      fontFamily: 'Inter_700Bold',
      color: colors.foreground,
      marginBottom: 8,
    },
    message: {
      fontSize: 14,
      fontFamily: 'Inter_400Regular',
      color: colors.mutedForeground,
      lineHeight: 20,
      marginBottom: 24,
    },
    actions: { flexDirection: 'row', gap: 10 },
    btn: {
      flex: 1,
      paddingVertical: 13,
      borderRadius: 12,
      alignItems: 'center',
    },
    cancelBtn: { backgroundColor: colors.secondary },
    confirmBtn: { backgroundColor: colors.destructive },
    cancelTxt: {
      color: colors.foreground,
      fontFamily: 'Inter_600SemiBold',
      fontSize: 15,
    },
    confirmTxt: {
      color: '#fff',
      fontFamily: 'Inter_600SemiBold',
      fontSize: 15,
    },
  });

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onCancel}>
      <Pressable style={s.overlay} onPress={onCancel}>
        <Pressable onPress={() => {}} style={s.container}>
          <Text style={s.title}>{title}</Text>
          <Text style={s.message}>{message}</Text>
          <View style={s.actions}>
            <TouchableOpacity style={[s.btn, s.cancelBtn]} onPress={onCancel}>
              <Text style={s.cancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.btn, s.confirmBtn]} onPress={onConfirm}>
              <Text style={s.confirmTxt}>{confirmLabel}</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
