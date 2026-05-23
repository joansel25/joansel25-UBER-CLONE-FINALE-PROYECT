import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity,
  StyleSheet, ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS, SPACING, FONT, RADIUS, SHADOW } from '../../constants/theme';

export default function RatingModal({ visible, onSubmit, loading, title = 'Califica tu viaje' }) {
  const [selected, setSelected] = useState(0);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Icon name="checkmark-circle" size={52} color={COLORS.success} style={styles.icon} />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.subtitle}>Tu opinión nos ayuda a mejorar el servicio</Text>

          <View style={styles.stars}>
            {[1, 2, 3, 4, 5].map(star => (
              <TouchableOpacity
                key={star}
                onPress={() => setSelected(star)}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
              >
                <Icon
                  name={star <= selected ? 'star' : 'star-outline'}
                  size={44}
                  color={star <= selected ? '#FFD700' : COLORS.border}
                />
              </TouchableOpacity>
            ))}
          </View>

          {selected > 0 && (
            <Text style={styles.ratingLabel}>{LABELS[selected]}</Text>
          )}

          <TouchableOpacity
            style={[styles.btn, (!selected || loading) && styles.btnDisabled]}
            onPress={() => selected && onSubmit(selected)}
            disabled={!selected || loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={COLORS.white} size="small" />
              : <Text style={styles.btnText}>Enviar calificación</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const LABELS = { 1: 'Muy malo', 2: 'Malo', 3: 'Regular', 4: 'Bueno', 5: 'Excelente' };

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center', padding: SPACING.lg,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: SPACING.lg,
    width: '100%',
    alignItems: 'center',
    ...SHADOW.card,
  },
  icon:     { marginBottom: SPACING.sm },
  title:    { fontSize: FONT.xl, fontWeight: '800', color: COLORS.dark, textAlign: 'center' },
  subtitle: { fontSize: FONT.sm, color: COLORS.gray, marginTop: 6, textAlign: 'center' },

  stars: {
    flexDirection: 'row', gap: SPACING.sm,
    marginVertical: SPACING.lg,
  },
  ratingLabel: { fontSize: FONT.md, color: COLORS.primary, fontWeight: '700', marginBottom: SPACING.sm },

  btn: {
    backgroundColor: COLORS.primary,
    height: 52, borderRadius: RADIUS.sm,
    width: '100%', alignItems: 'center', justifyContent: 'center',
    marginTop: SPACING.sm,
  },
  btnDisabled: { opacity: 0.45 },
  btnText:     { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },
});
