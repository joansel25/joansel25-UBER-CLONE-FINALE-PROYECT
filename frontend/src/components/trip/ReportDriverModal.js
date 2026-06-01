import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  ScrollView, TextInput, ActivityIndicator, Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import firestore from '@react-native-firebase/firestore';
import { getAuth } from '@react-native-firebase/auth';
import { COLORS, FONT, SPACING, RADIUS, SHADOW } from '../../constants/theme';

const REPORT_REASONS = [
  { id: 'dangerous_driving',  label: 'Conducción peligrosa',       icon: 'warning-outline' },
  { id: 'route_manipulation', label: 'Ruta incorrecta intencional', icon: 'map-outline' },
  { id: 'disrespect',         label: 'Actitud irrespetuosa',        icon: 'sad-outline' },
  { id: 'harassment',         label: 'Acoso o intimidación',        icon: 'alert-circle-outline' },
  { id: 'dirty_vehicle',      label: 'Vehículo en mal estado',      icon: 'car-outline' },
  { id: 'wrong_charge',       label: 'Cobro incorrecto',            icon: 'cash-outline' },
  { id: 'no_show',            label: 'No se presentó',              icon: 'person-remove-outline' },
  { id: 'other',              label: 'Otro motivo',                  icon: 'ellipsis-horizontal-outline' },
];

export default function ReportDriverModal({ visible, onClose, tripId, driverId, driverName }) {
  const [selectedReasons, setSelectedReasons] = useState([]);
  const [description, setDescription]         = useState('');
  const [submitting, setSubmitting]           = useState(false);

  function toggleReason(id) {
    setSelectedReasons(prev =>
      prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id],
    );
  }

  async function handleSubmit() {
    if (selectedReasons.length === 0) {
      Alert.alert('Selecciona al menos un motivo', 'Por favor elige qué fue lo que ocurrió.');
      return;
    }
    setSubmitting(true);
    try {
      const uid = getAuth().currentUser?.uid;
      await firestore().collection('reports').add({
        tripId,
        driverId,
        driverName,
        reportedBy:      uid,
        reasons:         selectedReasons,
        description:     description.trim() || null,
        status:          'pending',
        createdAt:       firestore.FieldValue.serverTimestamp(),
      });
      Alert.alert(
        'Reporte enviado',
        'Gracias por informarnos. Revisaremos el caso en las próximas 24 horas.',
        [{ text: 'Cerrar', onPress: handleClose }],
      );
    } catch {
      Alert.alert('Error', 'No se pudo enviar el reporte. Intenta de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    setSelectedReasons([]);
    setDescription('');
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Icon name="flag-outline" size={22} color={COLORS.danger} />
            <Text style={styles.headerTitle}>Reportar conductor</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Icon name="close" size={22} color={COLORS.gray} />
            </TouchableOpacity>
          </View>

          {driverName && (
            <Text style={styles.driverName}>Conductor: {driverName}</Text>
          )}

          <Text style={styles.sectionLabel}>¿Qué ocurrió? (selecciona todos los que apliquen)</Text>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
            <View style={styles.reasonsGrid}>
              {REPORT_REASONS.map(reason => {
                const isSelected = selectedReasons.includes(reason.id);
                return (
                  <TouchableOpacity
                    key={reason.id}
                    style={[styles.reasonCard, isSelected && styles.reasonCardSelected]}
                    onPress={() => toggleReason(reason.id)}
                    activeOpacity={0.75}
                  >
                    <Icon
                      name={reason.icon}
                      size={22}
                      color={isSelected ? COLORS.danger : COLORS.gray}
                    />
                    <Text style={[styles.reasonText, isSelected && styles.reasonTextSelected]}>
                      {reason.label}
                    </Text>
                    {isSelected && (
                      <Icon name="checkmark-circle" size={14} color={COLORS.danger} style={styles.checkmark} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.sectionLabel}>Descripción adicional (opcional)</Text>
            <TextInput
              style={styles.descInput}
              placeholder="Describe con detalle lo que sucedió..."
              placeholderTextColor={COLORS.gray}
              value={description}
              onChangeText={setDescription}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{description.length}/500</Text>

            <Text style={styles.disclaimer}>
              Los reportes son anónimos y serán revisados por nuestro equipo de seguridad.
            </Text>

            <TouchableOpacity
              style={[
                styles.submitBtn,
                (selectedReasons.length === 0 || submitting) && styles.submitBtnDisabled,
              ]}
              onPress={handleSubmit}
              disabled={selectedReasons.length === 0 || submitting}
              activeOpacity={0.85}
            >
              {submitting
                ? <ActivityIndicator color={COLORS.white} size="small" />
                : <>
                    <Icon name="send-outline" size={18} color={COLORS.white} />
                    <Text style={styles.submitBtnText}>Enviar reporte</Text>
                  </>
              }
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: SPACING.md,
    maxHeight: '90%',
    ...SHADOW.card,
  },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginBottom: SPACING.sm,
  },
  headerTitle: { flex: 1, fontSize: FONT.lg, fontWeight: '800', color: COLORS.dark },

  driverName: {
    fontSize: FONT.base, color: COLORS.gray,
    marginBottom: SPACING.sm,
  },

  sectionLabel: {
    fontSize: FONT.sm, fontWeight: '700', color: COLORS.dark,
    marginBottom: 10, marginTop: SPACING.sm,
  },

  scroll: { flex: 1 },

  reasonsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: SPACING.sm,
  },
  reasonCard: {
    width: '47%', borderRadius: RADIUS.sm,
    borderWidth: 1.5, borderColor: COLORS.border,
    backgroundColor: '#FAFAFA',
    padding: 10, alignItems: 'center', gap: 6,
    position: 'relative',
  },
  reasonCardSelected: { borderColor: COLORS.danger, backgroundColor: '#FFF0EF' },
  reasonText:         { fontSize: 11, fontWeight: '600', color: COLORS.gray, textAlign: 'center' },
  reasonTextSelected: { color: COLORS.danger },
  checkmark: { position: 'absolute', top: 4, right: 4 },

  descInput: {
    borderWidth: 1.5, borderColor: COLORS.border, borderRadius: RADIUS.sm,
    padding: SPACING.sm, fontSize: FONT.base, color: COLORS.dark,
    minHeight: 90,
  },
  charCount: { fontSize: 11, color: COLORS.gray, alignSelf: 'flex-end', marginTop: 4 },

  disclaimer: {
    fontSize: 11, color: COLORS.gray, textAlign: 'center',
    marginVertical: SPACING.sm, fontStyle: 'italic',
  },

  submitBtn: {
    backgroundColor: COLORS.danger,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: RADIUS.sm,
    marginBottom: SPACING.md,
  },
  submitBtnDisabled: { opacity: 0.45 },
  submitBtnText:     { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },
});
