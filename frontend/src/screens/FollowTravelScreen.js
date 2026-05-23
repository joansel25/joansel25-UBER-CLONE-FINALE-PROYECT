import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS, FONT, SPACING } from '../constants/theme';

// Placeholder — full tracking implementation in Phase 4
export default function FollowTravelScreen({ route, navigation }) {
  const tripId = route?.params?.tripId;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Icon name="car" size={64} color={COLORS.primary} />
        <Text style={styles.title}>Buscando conductor…</Text>
        <Text style={styles.subtitle}>ID del viaje: {tripId}</Text>
        <Text style={styles.note}>
          El seguimiento en tiempo real se implementa en la Fase 4.
        </Text>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelText}>Cancelar viaje</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  content: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: SPACING.lg, gap: SPACING.sm,
  },
  title:    { fontSize: FONT.xl, fontWeight: '800', color: COLORS.dark, textAlign: 'center' },
  subtitle: { fontSize: FONT.base, color: COLORS.gray },
  note:     { fontSize: FONT.sm, color: COLORS.gray, textAlign: 'center', marginTop: SPACING.sm },
  cancelBtn: {
    marginTop: SPACING.lg, paddingVertical: 12, paddingHorizontal: 32,
    borderRadius: 8, borderWidth: 2, borderColor: COLORS.danger,
  },
  cancelText: { color: COLORS.danger, fontWeight: '700', fontSize: FONT.base },
});
