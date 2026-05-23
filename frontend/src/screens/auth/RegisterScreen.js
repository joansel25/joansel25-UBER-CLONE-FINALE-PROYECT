import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
  Modal, FlatList, ActivityIndicator,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import Icon              from 'react-native-vector-icons/Ionicons';
import auth              from '@react-native-firebase/auth';
import { useAuth }       from '../../context/AuthContext';
import userApi           from '../../api/userApi';
import ErrorBanner       from '../../components/common/ErrorBanner';
import { COLORS, SPACING, RADIUS, FONT, SHADOW } from '../../constants/theme';

const GENDER_OPTIONS = [
  { label: 'Masculino', value: 'male',   icon: 'male-outline' },
  { label: 'Femenino',  value: 'female', icon: 'female-outline' },
  { label: 'Otro',      value: 'other',  icon: 'person-outline' },
];

const LANGUAGE_OPTIONS = [
  { label: 'Español', value: 'ES', flag: '🇨🇴' },
  { label: 'English', value: 'EN', flag: '🇬🇧' },
];

const EMPTY_ERRORS = { fullName: '', email: '', phone: '', gender: '', password: '', confirm: '' };

export default function RegisterScreen({ navigation }) {
  const { refreshUser } = useAuth();

  const [form, setForm] = useState({
    fullName: '', email: '', phone: '',
    password: '', confirm: '', gender: '', language: 'ES',
  });
  const [fieldErrors,     setFieldErrors]     = useState(EMPTY_ERRORS);
  const [globalError,     setGlobalError]     = useState('');
  const [showPass,        setShowPass]        = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [loading,         setLoading]         = useState(false);

  const set = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    // Clear field error on edit
    if (fieldErrors[key]) setFieldErrors(prev => ({ ...prev, [key]: '' }));
    setGlobalError('');
  };

  // ── Per-field validation ───────────────────────────────────────────────────
  const validate = () => {
    const errs = { ...EMPTY_ERRORS };
    let valid = true;

    if (!form.fullName.trim() || form.fullName.trim().length < 3) {
      errs.fullName = 'Mínimo 3 caracteres.'; valid = false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      errs.email = 'Formato inválido. Ejemplo: usuario@correo.com'; valid = false;
    }
    if (!/^\d{7,}$/.test(form.phone)) {
      errs.phone = 'Solo números, mínimo 7 dígitos.'; valid = false;
    }
    if (!form.gender) {
      errs.gender = 'Selecciona un género para continuar.'; valid = false;
    }
    if (form.password.length < 6) {
      errs.password = 'La contraseña debe tener al menos 6 caracteres.'; valid = false;
    }
    if (form.password !== form.confirm) {
      errs.confirm = 'Las contraseñas no coinciden.'; valid = false;
    }

    setFieldErrors(errs);
    return valid;
  };

  const handleRegister = async () => {
    setGlobalError('');
    if (!validate()) return;
    setLoading(true);

    try {
      // 1. Create Firebase Auth account
      const credential = await auth().createUserWithEmailAndPassword(
        form.email.trim().toLowerCase(),
        form.password,
      );
      const { uid } = credential.user;

      // 2. Register profile in MongoDB
      await userApi.register({
        fullName:    form.fullName.trim(),
        email:       form.email.trim().toLowerCase(),
        phone:       form.phone.trim(),
        gender:      form.gender,
        language:    form.language,
        firebaseUid: uid,
        role:        'passenger',
      });

      // 3. Pull profile into AuthContext → AppNavigator routes to Main
      await refreshUser();

    } catch (err) {
      // Rollback: delete Firebase account if backend registration failed
      const fbUser = auth().currentUser;
      if (fbUser && err.statusCode) {
        await fbUser.delete().catch(() => null);
      }
      setGlobalError(friendlyMessage(err.code, err.message));
    } finally {
      setLoading(false);
    }
  };

  const genderLabel = GENDER_OPTIONS.find(o => o.value === form.gender)?.label;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Header ── */}
          <View style={styles.header}>
            <Text style={styles.title}>Crear cuenta</Text>
            <Text style={styles.subtitle}>
              Completa tu información para comenzar
            </Text>
          </View>

          {/* ── Form card ── */}
          <View style={styles.card}>

            {/* Global error banner */}
            <ErrorBanner message={globalError} onDismiss={() => setGlobalError('')} />

            {/* Full name */}
            <Field label="Nombre completo" error={fieldErrors.fullName} required>
              <View style={[styles.inputRow, fieldErrors.fullName && styles.inputRowError]}>
                <Icon name="person-outline" size={18} color={COLORS.gray} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Tu nombre completo"
                  placeholderTextColor={COLORS.gray}
                  value={form.fullName}
                  onChangeText={v => set('fullName', v.slice(0, 50))}
                  editable={!loading}
                />
                <Text style={styles.counter}>{form.fullName.length}/50</Text>
              </View>
            </Field>

            {/* Email */}
            <Field label="Correo electrónico" error={fieldErrors.email} required>
              <View style={[styles.inputRow, fieldErrors.email && styles.inputRowError]}>
                <Icon name="mail-outline" size={18} color={COLORS.gray} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="usuario@correo.com"
                  placeholderTextColor={COLORS.gray}
                  value={form.email}
                  onChangeText={v => set('email', v)}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
              </View>
            </Field>

            {/* Phone */}
            <Field label="Teléfono" error={fieldErrors.phone} required>
              <View style={[styles.inputRow, fieldErrors.phone && styles.inputRowError]}>
                <Icon name="call-outline" size={18} color={COLORS.gray} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="3001234567"
                  placeholderTextColor={COLORS.gray}
                  value={form.phone}
                  onChangeText={v => set('phone', v.replace(/[^0-9]/g, ''))}
                  keyboardType="numeric"
                  editable={!loading}
                />
              </View>
            </Field>

            {/* Gender */}
            <Field label="Género" error={fieldErrors.gender} required>
              <TouchableOpacity
                style={[styles.inputRow, fieldErrors.gender && styles.inputRowError]}
                onPress={() => setShowGenderModal(true)}
                disabled={loading}
              >
                <Icon name="people-outline" size={18} color={COLORS.gray} style={styles.inputIcon} />
                <Text style={[styles.input, { paddingVertical: 0, lineHeight: 50 }, !genderLabel && { color: COLORS.gray }]}>
                  {genderLabel ?? 'Seleccionar género'}
                </Text>
                <Icon name="chevron-down" size={16} color={COLORS.gray} />
              </TouchableOpacity>
            </Field>

            {/* Language */}
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>Idioma preferido</Text>
              <View style={styles.langRow}>
                {LANGUAGE_OPTIONS.map(lang => (
                  <TouchableOpacity
                    key={lang.value}
                    style={[styles.langBtn, form.language === lang.value && styles.langBtnActive]}
                    onPress={() => set('language', lang.value)}
                    disabled={loading}
                  >
                    <Text style={styles.langFlag}>{lang.flag}</Text>
                    <Text style={[styles.langText, form.language === lang.value && styles.langTextActive]}>
                      {lang.label}
                    </Text>
                    {form.language === lang.value &&
                      <Icon name="checkmark-circle" size={14} color={COLORS.white} />
                    }
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Password */}
            <Field label="Contraseña" error={fieldErrors.password} hint="Mínimo 6 caracteres" required>
              <View style={[styles.inputRow, fieldErrors.password && styles.inputRowError]}>
                <Icon name="lock-closed-outline" size={18} color={COLORS.gray} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={COLORS.gray}
                  value={form.password}
                  onChangeText={v => set('password', v)}
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                  editable={!loading}
                />
                <TouchableOpacity onPress={() => setShowPass(v => !v)}>
                  <Icon name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.gray} />
                </TouchableOpacity>
              </View>
            </Field>

            {/* Confirm password */}
            <Field label="Confirmar contraseña" error={fieldErrors.confirm} required>
              <View style={[styles.inputRow, fieldErrors.confirm && styles.inputRowError]}>
                <Icon name="lock-closed-outline" size={18} color={COLORS.gray} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={COLORS.gray}
                  value={form.confirm}
                  onChangeText={v => set('confirm', v)}
                  secureTextEntry={!showConfirm}
                  autoCapitalize="none"
                  editable={!loading}
                />
                <TouchableOpacity onPress={() => setShowConfirm(v => !v)}>
                  <Icon name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.gray} />
                </TouchableOpacity>
              </View>
            </Field>

            {/* Submit */}
            <TouchableOpacity
              style={[styles.primaryBtn, loading && styles.btnDisabled]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={COLORS.white} size="small" />
                : <>
                    <Icon name="person-add-outline" size={18} color={COLORS.white} />
                    <Text style={styles.primaryBtnText}>Crear cuenta</Text>
                  </>
              }
            </TouchableOpacity>

            {/* Back to Login */}
            {navigation && (
              <TouchableOpacity
                style={styles.loginLink}
                onPress={() => navigation.navigate('Login')}
                disabled={loading}
              >
                <Text style={styles.loginLinkText}>
                  ¿Ya tienes cuenta?{' '}
                  <Text style={styles.loginLinkBold}>Inicia sesión</Text>
                </Text>
              </TouchableOpacity>
            )}

          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ── Gender Modal ── */}
      <Modal
        visible={showGenderModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGenderModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowGenderModal(false)}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Seleccionar género</Text>
            <FlatList
              data={GENDER_OPTIONS}
              keyExtractor={item => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.optionRow, form.gender === item.value && styles.optionRowActive]}
                  onPress={() => { set('gender', item.value); setShowGenderModal(false); }}
                >
                  <View style={[styles.optionIcon, form.gender === item.value && styles.optionIconActive]}>
                    <Icon
                      name={item.icon}
                      size={20}
                      color={form.gender === item.value ? COLORS.white : COLORS.gray}
                    />
                  </View>
                  <Text style={[styles.optionText, form.gender === item.value && styles.optionTextActive]}>
                    {item.label}
                  </Text>
                  {form.gender === item.value &&
                    <Icon name="checkmark-circle" size={22} color={COLORS.primary} />
                  }
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

// ── Reusable field wrapper ────────────────────────────────────────────────────
function Field({ label, error, hint, required, children }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>
        {label}{required && <Text style={styles.required}> *</Text>}
      </Text>
      {children}
      {error ? (
        <View style={styles.fieldErrorRow}>
          <Icon name="alert-circle-outline" size={13} color={COLORS.danger} />
          <Text style={styles.fieldError}>{error}</Text>
        </View>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

// ── Firebase → friendly Spanish messages ─────────────────────────────────────
function friendlyMessage(code, fallback) {
  const map = {
    'auth/email-already-in-use':
      'Ya existe una cuenta con ese correo. ¿Quieres iniciar sesión?',
    'auth/invalid-email':
      'El formato del correo no es válido. Ejemplo: usuario@correo.com',
    'auth/weak-password':
      'La contraseña es muy débil. Usa al menos 6 caracteres con letras y números.',
    'auth/network-request-failed':
      'Sin conexión a internet. Verifica tu red e intenta de nuevo.',
    'auth/configuration-not':
      'El servicio de registro no está disponible en este momento. Verifica tu conexión e intenta más tarde.',
    'auth/internal-error':
      'Ocurrió un problema interno. Por favor intenta de nuevo en unos segundos.',
    'auth/too-many-requests':
      'Demasiados intentos en poco tiempo. Espera unos minutos e intenta de nuevo.',
    'auth/operation-not-allowed':
      'El registro con correo no está habilitado. Contacta al administrador.',
  };
  return map[code] ?? fallback ?? 'Algo salió mal. Por favor intenta de nuevo.';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F7FA' },
  scroll:    { flexGrow: 1, padding: SPACING.lg, paddingTop: SPACING.md },

  header:   { marginBottom: SPACING.md },
  title:    { fontSize: FONT.xxl, fontWeight: '800', color: COLORS.dark, letterSpacing: -0.5 },
  subtitle: { fontSize: FONT.base, color: COLORS.gray, marginTop: 6 },

  card: {
    backgroundColor: COLORS.white, borderRadius: 20,
    padding: SPACING.md,
    ...SHADOW.card, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4,
    marginBottom: SPACING.lg,
  },

  fieldWrap: { marginBottom: SPACING.sm + 4 },
  label:     { fontSize: FONT.sm, fontWeight: '600', color: COLORS.gray, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  required:  { color: COLORS.danger },

  inputRow: {
    flexDirection: 'row', alignItems: 'center', height: 50,
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.sm, paddingHorizontal: 12,
    backgroundColor: COLORS.inputBg,
  },
  inputRowError: { borderColor: COLORS.danger },
  inputIcon:     { marginRight: 10 },
  input:         { flex: 1, fontSize: FONT.base, color: COLORS.dark },
  counter:       { fontSize: 11, color: COLORS.gray },

  fieldErrorRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5 },
  fieldError:    { fontSize: 12, color: COLORS.danger, flex: 1 },
  hint:          { fontSize: 12, color: COLORS.gray, marginTop: 5, fontStyle: 'italic' },

  langRow: { flexDirection: 'row', gap: 12 },
  langBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, borderWidth: 2, borderColor: COLORS.border,
    borderRadius: RADIUS.sm, backgroundColor: COLORS.inputBg, gap: 6,
  },
  langBtnActive:  { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  langFlag:       { fontSize: 18 },
  langText:       { fontSize: FONT.base, fontWeight: '600', color: COLORS.dark },
  langTextActive: { color: COLORS.white },

  primaryBtn: {
    backgroundColor: COLORS.success, height: 52,
    borderRadius: RADIUS.sm,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: SPACING.xs,
  },
  btnDisabled:    { opacity: 0.55 },
  primaryBtnText: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },

  loginLink:      { alignItems: 'center', paddingVertical: SPACING.sm },
  loginLinkText:  { fontSize: FONT.base, color: COLORS.gray },
  loginLinkBold:  { color: COLORS.primary, fontWeight: '700' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: SPACING.md, paddingBottom: 34,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: SPACING.md,
  },
  modalTitle:      { fontSize: FONT.lg, fontWeight: '800', color: COLORS.dark, marginBottom: SPACING.sm },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
  },
  optionRowActive: { backgroundColor: '#F0F8FF', borderRadius: RADIUS.sm, paddingHorizontal: 8 },
  optionIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.lightGray, alignItems: 'center', justifyContent: 'center',
  },
  optionIconActive: { backgroundColor: COLORS.primary },
  optionText:       { flex: 1, fontSize: FONT.md, color: COLORS.dark, fontWeight: '500' },
  optionTextActive: { color: COLORS.primary, fontWeight: '700' },
});
