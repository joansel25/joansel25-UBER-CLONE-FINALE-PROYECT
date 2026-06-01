import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity,
  StyleSheet, ActivityIndicator, TextInput, ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { COLORS, SPACING, FONT, RADIUS, SHADOW } from '../../constants/theme';

const LABELS = { 1: 'Muy malo', 2: 'Malo', 3: 'Regular', 4: 'Bueno', 5: 'Excelente' };

// Predefined comment suggestions shown for low ratings (≤ 3 stars)
const SUGGESTIONS = [
  'Conducción peligrosa',
  'Actitud irrespetuosa',
  'Vehículo sucio',
  'Ruta incorrecta',
  'Llegó tarde',
  'Cobro incorrecto',
];

export default function RatingModal({ visible, onSubmit, loading, title = 'Califica tu viaje' }) {
  const [selected, setSelected]   = useState(0);
  const [comment, setComment]     = useState('');
  const [chips, setChips]         = useState([]);

  const isLowRating = selected > 0 && selected <= 3;

  function toggleChip(chip) {
    setChips(prev =>
      prev.includes(chip) ? prev.filter(c => c !== chip) : [...prev, chip],
    );
  }

  function handleSubmit() {
    if (!selected) return;
    const feedback = isLowRating
      ? [chips.join(', '), comment].filter(Boolean).join(' · ')
      : undefined;
    onSubmit(selected, feedback ?? undefined);
  }

  function handleSelectStar(star) {
    setSelected(star);
    if (star > 3) {
      setComment('');
      setChips([]);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.overlay}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.card}>
            <Icon name="checkmark-circle" size={52} color={COLORS.success} style={styles.icon} />
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.subtitle}>Tu opinión nos ayuda a mejorar el servicio</Text>

            <View style={styles.stars}>
              {[1, 2, 3, 4, 5].map(star => (
                <TouchableOpacity
                  key={star}
                  onPress={() => handleSelectStar(star)}
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
              <Text style={[styles.ratingLabel, isLowRating && { color: COLORS.danger }]}>
                {LABELS[selected]}
              </Text>
            )}

            {/* Low-rating feedback section */}
            {isLowRating && (
              <View style={styles.feedbackSection}>
                <Text style={styles.feedbackTitle}>¿Qué salió mal?</Text>
                <View style={styles.chipsRow}>
                  {SUGGESTIONS.map(chip => (
                    <TouchableOpacity
                      key={chip}
                      style={[styles.chip, chips.includes(chip) && styles.chipSelected]}
                      onPress={() => toggleChip(chip)}
                    >
                      <Text style={[styles.chipText, chips.includes(chip) && styles.chipTextSelected]}>
                        {chip}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <TextInput
                  style={styles.commentInput}
                  placeholder="Cuéntanos más sobre tu experiencia..."
                  placeholderTextColor={COLORS.gray}
                  value={comment}
                  onChangeText={setComment}
                  multiline
                  maxLength={300}
                  textAlignVertical="top"
                />
                <Text style={styles.charCount}>{comment.length}/300</Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.btn, (!selected || loading) && styles.btnDisabled]}
              onPress={handleSubmit}
              disabled={!selected || loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={COLORS.white} size="small" />
                : <Text style={styles.btnText}>Enviar calificación</Text>
              }
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', padding: SPACING.lg,
  },
  scrollContent: { flexGrow: 1, justifyContent: 'center' },
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

  feedbackSection: { width: '100%', marginBottom: SPACING.sm },
  feedbackTitle: { fontSize: FONT.base, fontWeight: '700', color: COLORS.dark, marginBottom: 10 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.sm },
  chip: {
    borderRadius: 16, borderWidth: 1.5, borderColor: COLORS.border,
    paddingVertical: 5, paddingHorizontal: 12,
    backgroundColor: COLORS.white,
  },
  chipSelected: { borderColor: COLORS.danger, backgroundColor: '#FFF0EF' },
  chipText:     { fontSize: FONT.sm, color: COLORS.gray, fontWeight: '600' },
  chipTextSelected: { color: COLORS.danger },

  commentInput: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.sm,
    padding: SPACING.sm, fontSize: FONT.base, color: COLORS.dark,
    minHeight: 80, width: '100%',
  },
  charCount: { fontSize: 11, color: COLORS.gray, alignSelf: 'flex-end', marginTop: 4 },

  btn: {
    backgroundColor: COLORS.primary,
    height: 52, borderRadius: RADIUS.sm,
    width: '100%', alignItems: 'center', justifyContent: 'center',
    marginTop: SPACING.sm,
  },
  btnDisabled: { opacity: 0.45 },
  btnText:     { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },
});
