import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

import driverApi   from '../../api/driverApi';
import { useAuth } from '../../context/AuthContext';
import ErrorBanner from '../../components/common/ErrorBanner';
import { COLORS, SPACING, FONT, RADIUS, SHADOW } from '../../constants/theme';

// ── Reusable field ───────────────────────────────────────────────────────────

function Field({ label, children, error }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

function TextRow({ iconName, placeholder, value, onChangeText, keyboardType = 'default', autoCapitalize = 'words', error }) {
  const { TextInput } = require('react-native');
  return (
    <View style={[styles.inputRow, error && styles.inputRowError]}>
      <Icon name={iconName} size={17} color={COLORS.gray} style={styles.inputIcon} />
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor={COLORS.gray}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
        autoCorrect={false}
      />
    </View>
  );
}

// ── Screen ───────────────────────────────────────────────────────────────────

export default function DriverRegisterScreen({ navigation }) {
  const { refreshUser } = useAuth();

  const [form, setForm] = useState({
    make:          '',
    model:         '',
    year:          '',
    color:         '',
    plate:         '',
    licenseNumber: '',
  });
  const [errors,    setErrors]    = useState({});
  const [globalErr, setGlobalErr] = useState('');
  const [loading,   setLoading]   = useState(false);

  const set = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    setErrors(prev => ({ ...prev, [key]: '' }));
    setGlobalErr('');
  };

  const validate = () => {
    const e = {};
    if (!form.make.trim())          e.make          = 'Ingresa la marca del vehículo.';
    if (!form.model.trim())         e.model         = 'Ingresa el modelo del vehículo.';
    const yr = parseInt(form.year, 10);
    if (!form.year || isNaN(yr) || yr < 1990 || yr > new Date().getFullYear() + 1)
      e.year = 'Ingresa un año válido (1990 – ' + (new Date().getFullYear() + 1) + ').';
    if (!form.color.trim())         e.color         = 'Ingresa el color del vehículo.';
    if (!form.plate.trim())         e.plate         = 'Ingresa la placa del vehículo.';
    if (!form.licenseNumber.trim()) e.licenseNumber = 'Ingresa tu número de licencia.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    setGlobalErr('');
    try {
      const vehicleInfo = {
        make:  form.make.trim(),
        model: form.model.trim(),
        year:  parseInt(form.year, 10),
        color: form.color.trim(),
        plate: form.plate.trim().toUpperCase(),
      };
      await driverApi.register(vehicleInfo, form.licenseNumber.trim());

      // Refresh dbUser — backend updated role to 'driver'
      // AppNavigator will automatically route to DriverTabNavigator
      await refreshUser();
    } catch (err) {
      setGlobalErr(
        err.response?.data?.message ?? err.message ?? 'No se pudo completar el registro. Intenta de nuevo.',
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="arrow-back" size={22} color={COLORS.dark} />
          </TouchableOpacity>
          <Text style={styles.title}>Registro de conductor</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ErrorBanner message={globalErr} onDismiss={() => setGlobalErr('')} />

          {/* Intro card */}
          <View style={styles.infoCard}>
            <Icon name="car-sport-outline" size={32} color={COLORS.primary} />
            <View style={{ flex: 1 }}>
              <Text style={styles.infoTitle}>Únete como conductor</Text>
              <Text style={styles.infoSub}>
                Completa los datos de tu vehículo y licencia para empezar a recibir viajes.
              </Text>
            </View>
          </View>

          {/* Vehicle section */}
          <Text style={styles.sectionTitle}>Vehículo</Text>

          <Field label="Marca *" error={errors.make}>
            <TextRow
              iconName="car-outline"
              placeholder="Ej. Toyota, Chevrolet"
              value={form.make}
              onChangeText={v => set('make', v)}
              error={errors.make}
            />
          </Field>

          <Field label="Modelo *" error={errors.model}>
            <TextRow
              iconName="car-outline"
              placeholder="Ej. Corolla, Spark"
              value={form.model}
              onChangeText={v => set('model', v)}
              error={errors.model}
            />
          </Field>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Field label="Año *" error={errors.year}>
                <TextRow
                  iconName="calendar-outline"
                  placeholder="Ej. 2020"
                  value={form.year}
                  onChangeText={v => set('year', v)}
                  keyboardType="numeric"
                  autoCapitalize="none"
                  error={errors.year}
                />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="Color *" error={errors.color}>
                <TextRow
                  iconName="color-palette-outline"
                  placeholder="Ej. Rojo"
                  value={form.color}
                  onChangeText={v => set('color', v)}
                  error={errors.color}
                />
              </Field>
            </View>
          </View>

          <Field label="Placa *" error={errors.plate}>
            <TextRow
              iconName="id-card-outline"
              placeholder="Ej. ABC123"
              value={form.plate}
              onChangeText={v => set('plate', v.toUpperCase())}
              autoCapitalize="characters"
              error={errors.plate}
            />
          </Field>

          {/* License section */}
          <Text style={styles.sectionTitle}>Licencia de conducción</Text>

          <Field label="Número de licencia *" error={errors.licenseNumber}>
            <TextRow
              iconName="document-text-outline"
              placeholder="Ej. 123456789"
              value={form.licenseNumber}
              onChangeText={v => set('licenseNumber', v)}
              autoCapitalize="none"
              error={errors.licenseNumber}
            />
          </Field>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, loading && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading
              ? <ActivityIndicator color={COLORS.white} size="small" />
              : <>
                  <Icon name="checkmark-circle-outline" size={20} color={COLORS.white} />
                  <Text style={styles.submitBtnText}>Registrarme como conductor</Text>
                </>
            }
          </TouchableOpacity>

          <Text style={styles.disclaimer}>
            Al registrarte como conductor aceptas nuestros Términos del Servicio y confirmas que tu licencia y vehículo cumplen con los requisitos legales vigentes.
          </Text>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { padding: 4 },
  title:   { fontSize: FONT.lg, fontWeight: '800', color: COLORS.dark },

  scroll: { padding: SPACING.md, paddingBottom: SPACING.xl },

  infoCard: {
    backgroundColor: COLORS.primaryLight, borderRadius: RADIUS.md,
    flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm,
    padding: SPACING.md, marginBottom: SPACING.md,
  },
  infoTitle: { fontSize: FONT.base, fontWeight: '800', color: COLORS.primary },
  infoSub:   { fontSize: FONT.sm, color: COLORS.primary, marginTop: 4, lineHeight: 18 },

  sectionTitle: {
    fontSize: FONT.sm, fontWeight: '700', color: COLORS.gray,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: SPACING.sm, marginBottom: SPACING.sm,
  },

  field:      { marginBottom: SPACING.sm },
  label:      { fontSize: FONT.sm, fontWeight: '600', color: COLORS.gray, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 },
  fieldError: { fontSize: 12, color: COLORS.danger, marginTop: 4 },

  row: { flexDirection: 'row', gap: SPACING.sm },

  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.sm, paddingHorizontal: 12,
    backgroundColor: COLORS.white, height: 50,
  },
  inputRowError: { borderColor: COLORS.danger },
  inputIcon:     { marginRight: 8 },
  input:         { flex: 1, fontSize: FONT.base, color: COLORS.dark },

  submitBtn: {
    backgroundColor: COLORS.success, height: 54, borderRadius: RADIUS.sm,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: SPACING.md,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText:     { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },

  disclaimer: {
    fontSize: 11, color: COLORS.gray, textAlign: 'center',
    marginTop: SPACING.md, lineHeight: 16, paddingHorizontal: SPACING.sm,
  },
});
