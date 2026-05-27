import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ScrollView,
  Modal, FlatList, ActivityIndicator,
} from 'react-native';
import { SafeAreaView }  from 'react-native-safe-area-context';
import Icon              from 'react-native-vector-icons/Ionicons';
import { getAuth, createUserWithEmailAndPassword, deleteUser } from '@react-native-firebase/auth';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';
import userApi     from '../../api/userApi';
import logger      from '../../utils/logger';
import ErrorBanner from '../../components/common/ErrorBanner';
import { COLORS, SPACING, RADIUS, FONT, SHADOW } from '../../constants/theme';

const GENDER_OPTIONS = [
  { labelKey: 'register_gender_male',   value: 'male',   icon: 'male-outline' },
  { labelKey: 'register_gender_female', value: 'female', icon: 'female-outline' },
  { labelKey: 'register_gender_other',  value: 'other',  icon: 'person-outline' },
];

const LANGUAGE_OPTIONS = [
  { label: 'Español', value: 'ES', flag: '🇨🇴' },
  { label: 'English', value: 'EN', flag: '🇬🇧' },
];

const EMPTY_ERRORS = { fullName: '', email: '', phone: '', gender: '', password: '', confirm: '' };

export default function RegisterScreen({ navigation }) {
  const { forceUserFound, refreshUser, signIn, signOut, firebaseUser, setIsRegistering } = useAuth();
  const { t } = useTranslation();

  const isCompletingProfile = !!firebaseUser;

  const [form, setForm] = useState({
    fullName: '',
    email:    firebaseUser?.email ?? '',
    phone:    '',
    password: '', confirm: '', gender: '', language: 'ES',
  });
  const [fieldErrors,     setFieldErrors]     = useState(EMPTY_ERRORS);
  const [globalError,     setGlobalError]     = useState('');
  const [showPass,        setShowPass]        = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [step,            setStep]            = useState('');

  const set = (key, value) => {
    setForm(prev => ({ ...prev, [key]: value }));
    if (fieldErrors[key]) setFieldErrors(prev => ({ ...prev, [key]: '' }));
    setGlobalError('');
  };

  // ── Per-field validation ──────────────────────────────────────────────────
  const validate = () => {
    const errs = { ...EMPTY_ERRORS };
    let valid = true;

    if (!form.fullName.trim() || form.fullName.trim().length < 3) {
      errs.fullName = t('register_err_name'); valid = false;
    }
    if (!isCompletingProfile) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        errs.email = t('register_err_email'); valid = false;
      }
      if (form.password.length < 6) {
        errs.password = t('register_err_pass'); valid = false;
      }
      if (form.password !== form.confirm) {
        errs.confirm = t('register_err_confirm'); valid = false;
      }
    }
    if (!/^\d{7,}$/.test(form.phone)) {
      errs.phone = t('register_err_phone'); valid = false;
    }
    if (!form.gender) {
      errs.gender = t('register_err_gender'); valid = false;
    }

    setFieldErrors(errs);
    return valid;
  };

  const handleRegister = async () => {
    setGlobalError('');
    if (!validate()) return;
    setLoading(true);
    setIsRegistering(true);

    let firebaseCreatedHere = false;
    let registerSucceeded   = false;

    try {
      let uid, email;

      logger.step('Register', isCompletingProfile ? 'Mode: complete existing profile' : 'Mode: full registration');

      if (isCompletingProfile) {
        uid   = firebaseUser.uid;
        email = firebaseUser.email;
        logger.info('Register', `Reusing Firebase account: ${email}`);
      } else {
        setStep(t('register_step_firebase'));
        logger.step('Register', `Step 1 — Creating Firebase account: ${form.email.trim()}`);
        const credential = await createUserWithEmailAndPassword(
          getAuth(),
          form.email.trim().toLowerCase(),
          form.password,
        );
        uid   = credential.user.uid;
        email = form.email.trim().toLowerCase();
        firebaseCreatedHere = true;
        logger.ok('Register', `Step 1 ✓ Firebase UID: ${uid.slice(0, 8)}…`);
      }

      setStep(t('register_step_profile'));
      logger.step('Register', 'Step 2 — Saving profile to Firestore…');
      const registered = await userApi.register({
        fullName:    form.fullName.trim(),
        email,
        phone:       form.phone.trim(),
        gender:      form.gender,
        language:    form.language,
        firebaseUid: uid,
        role:        'passenger',
      });
      registerSucceeded = true;
      logger.ok('Register', 'Step 2 ✓ Profile saved to Firestore');

      setStep(t('register_step_enter'));
      logger.step('Register', 'Step 3 — activating session in context…');
      // Set user directly from what we just wrote — no extra Firestore GET needed
      await forceUserFound(registered.data);
      logger.ok('Register', 'Step 3 ✓ Registration complete — redirecting to app');

    } catch (err) {
      logger.error('Register', `Error — code:${err.code ?? 'no code'} | statusCode:${err.statusCode ?? 'n/a'} | ${err.message}`);

      // Email already registered in Firebase → attempt auto-login with same password
      if (err.code === 'auth/email-already-in-use') {
        logger.info('Register', 'Email already in Firebase — attempting auto-login with same password...');
        try {
          await signIn(form.email.trim().toLowerCase(), form.password);
          logger.ok('Register', 'Auto-login successful — onAuthStateChanged will detect the profile');
          // onAuthStateChanged handles: Firestore profile exists → main app
          // no Firestore profile (profileStatus = not_found) → RegisterScreen (complete profile)
          return;
        } catch (signInErr) {
          logger.warn('Register', `Auto-login failed — code:${signInErr.code} | ${signInErr.message}`);
          // Different password from prior attempt — send user to login screen
          setGlobalError(
            'Ya existe una cuenta con ese correo pero con otra contraseña. ' +
            'Ve a "Iniciar sesión" y usa tu contraseña anterior. ' +
            'Si la olvidaste, usa la opción "Olvidé mi contraseña".'
          );
          return;
        }
      }

      // Firestore write failed → rollback only on server/network errors
      if (firebaseCreatedHere && !registerSucceeded) {
        const isFirebaseError   = err.code?.startsWith('auth/');
        const isValidationError = err.statusCode === 400 || err.statusCode === 409;
        // Do NOT rollback on permission errors — the Firebase Auth account is valid,
        // the problem is Firestore security rules. User can fix rules and try again.
        const isPermissionError = err.isPermissionError || err.statusCode === 403;

        if (!isFirebaseError && !isValidationError && !isPermissionError) {
          logger.warn('Register', 'Network/server error — rolling back Firebase account…');
          const fbUser = getAuth().currentUser;
          if (fbUser) {
            try {
              await deleteUser(fbUser);
              logger.ok('Register', 'Rollback complete — Firebase account deleted');
            } catch (rollbackErr) {
              logger.error('Register', `Rollback failed: ${rollbackErr.message} — Firebase user may be orphaned`);
            }
          }
        }
      }

      setGlobalError(friendlyMessage(err.code, err.message, err.statusCode, t));
    } finally {
      setIsRegistering(false);
      setLoading(false);
      setStep('');
    }
  };

  const genderOption = GENDER_OPTIONS.find(o => o.value === form.gender);
  const genderLabel = genderOption ? t(genderOption.labelKey) : undefined;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Header ── */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {isCompletingProfile ? t('register_complete') : t('register_title')}
            </Text>
            <Text style={styles.subtitle}>
              {isCompletingProfile
                ? 'Tu cuenta ya existe. Ingresa tus datos para continuar.'
                : 'Completa tu información para comenzar'}
            </Text>
          </View>

          {/* ── Form card ── */}
          <View style={styles.card}>

            <ErrorBanner message={globalError} onDismiss={() => setGlobalError('')} />

            {/* Indicador de paso actual */}
            {loading && step ? (
              <View style={styles.stepRow}>
                <ActivityIndicator size="small" color={COLORS.primary} />
                <Text style={styles.stepText}>{step}</Text>
              </View>
            ) : null}

            {/* Full name */}
            <Field label={t('personal_name_label')} error={fieldErrors.fullName} required>
              <View style={[styles.inputRow, fieldErrors.fullName && styles.inputRowError]}>
                <Icon name="person-outline" size={18} color={COLORS.gray} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('register_name_ph')}
                  placeholderTextColor={COLORS.gray}
                  value={form.fullName}
                  onChangeText={v => set('fullName', v.slice(0, 50))}
                  editable={!loading}
                />
                <Text style={styles.counter}>{form.fullName.length}/50</Text>
              </View>
            </Field>

            {/* Email */}
            {!isCompletingProfile && (
              <Field label={t('login_email_label')} error={fieldErrors.email} required>
                <View style={[styles.inputRow, fieldErrors.email && styles.inputRowError]}>
                  <Icon name="mail-outline" size={18} color={COLORS.gray} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder={t('register_email_ph')}
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
            )}

            {isCompletingProfile && (
              <View style={styles.fieldWrap}>
                <Text style={styles.label}>{t('login_email_label')}</Text>
                <View style={[styles.inputRow, styles.inputRowReadonly]}>
                  <Icon name="mail-outline" size={18} color={COLORS.gray} style={styles.inputIcon} />
                  <Text style={[styles.input, { color: COLORS.gray }]}>{form.email}</Text>
                  <Icon name="lock-closed" size={14} color={COLORS.gray} />
                </View>
              </View>
            )}

            {/* Phone */}
            <Field label={t('personal_phone_label')} error={fieldErrors.phone} required>
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
            <Field label={t('personal_gender_label')} error={fieldErrors.gender} required>
              <TouchableOpacity
                style={[styles.inputRow, fieldErrors.gender && styles.inputRowError]}
                onPress={() => setShowGenderModal(true)}
                disabled={loading}
              >
                <Icon name="people-outline" size={18} color={COLORS.gray} style={styles.inputIcon} />
                <Text style={[styles.input, { paddingVertical: 0, lineHeight: 50 }, !genderLabel && { color: COLORS.gray }]}>
                  {genderLabel ?? t('register_select_gender')}
                </Text>
                <Icon name="chevron-down" size={16} color={COLORS.gray} />
              </TouchableOpacity>
            </Field>

            {/* Language */}
            <View style={styles.fieldWrap}>
              <Text style={styles.label}>{t('prefs_lang_label')}</Text>
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
            {!isCompletingProfile && (
              <>
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
              </>
            )}

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
                    <Icon
                      name={isCompletingProfile ? 'checkmark-circle-outline' : 'person-add-outline'}
                      size={18}
                      color={COLORS.white}
                    />
                    <Text style={styles.primaryBtnText}>
                      {isCompletingProfile ? t('register_save_btn') : t('register_btn')}
                    </Text>
                  </>
              }
            </TouchableOpacity>

            {!isCompletingProfile && navigation && (
              <TouchableOpacity
                style={styles.loginLink}
                onPress={() => navigation.navigate('Login')}
                disabled={loading}
              >
                <Text style={styles.loginLinkText}>
                  {t('register_already')}{' '}
                  <Text style={styles.loginLinkBold}>{t('register_login_link')}</Text>
                </Text>
              </TouchableOpacity>
            )}

            {isCompletingProfile && (
              <TouchableOpacity
                style={styles.loginLink}
                onPress={() => signOut()}
                disabled={loading}
              >
                <Text style={styles.loginLinkText}>
                  ¿No eres tú?{' '}
                  <Text style={styles.loginLinkBold}>Cerrar sesión</Text>
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
            <Text style={styles.modalTitle}>{t('register_select_gender')}</Text>
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
                    {t(item.labelKey)}
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

// ── Reusable field wrapper ──────────────────────────────────────────────────
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

// ── Firebase / Network → user-friendly messages ─────────────────────────────
function friendlyMessage(code, fallback, statusCode, t) {
  const map = {
    'auth/email-already-in-use':
      'Ya existe una cuenta con ese correo. Si olvidaste tu contraseña, usa la opción "Olvidé mi contraseña" en el login.',
    'auth/invalid-email':    t('register_err_email'),
    'auth/weak-password':    t('register_err_pass'),
    'auth/network-request-failed':
      'No se pudo conectar con Firebase. Verifica tu conexión a internet.',
    'auth/too-many-requests':
      'Demasiados intentos en poco tiempo. Espera unos minutos e intenta de nuevo.',
    'auth/operation-not-allowed':
      'El registro con correo no está habilitado. Contacta al administrador.',
  };

  if (map[code]) return map[code];

  if (statusCode === 400) {
    return `Datos inválidos: ${fallback}`;
  }
  if (statusCode === 409 || (fallback && fallback.toLowerCase().includes('ya existe'))) {
    return 'Ya existe un usuario con ese correo o UID. Intenta iniciar sesión.';
  }
  if (statusCode === 403 || code === 'permission-denied' || code === 'firestore/permission-denied') {
    return 'Las reglas de Firestore bloquean el registro. Ve a Firebase Console → Firestore → Reglas y publica: allow read, write: if request.auth != null;';
  }
  if (statusCode === 408) {
    return fallback ?? 'Sin respuesta de Firestore. Verifica tu conexión y que la base de datos esté creada en Firebase Console.';
  }
  if (!code && (statusCode === 0 || (typeof fallback === 'string' && fallback.toLowerCase().includes('network')))) {
    return 'No se pudo conectar. Verifica tu conexión a internet e inténtalo de nuevo.';
  }

  return fallback ?? t('login_err_default');
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

  stepRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F0F8FF', borderRadius: 8, padding: 10, marginBottom: SPACING.sm,
  },
  stepText: { fontSize: FONT.sm, color: COLORS.primary, fontWeight: '600' },

  fieldWrap: { marginBottom: SPACING.sm + 4 },
  label:     { fontSize: FONT.sm, fontWeight: '600', color: COLORS.gray, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  required:  { color: COLORS.danger },

  inputRow: {
    flexDirection: 'row', alignItems: 'center', height: 50,
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.sm, paddingHorizontal: 12,
    backgroundColor: COLORS.inputBg,
  },
  inputRowError:    { borderColor: COLORS.danger },
  inputRowReadonly: { borderColor: COLORS.border, backgroundColor: '#F0F0F0', opacity: 0.8 },
  inputIcon:        { marginRight: 10 },
  input:            { flex: 1, fontSize: FONT.base, color: COLORS.dark },
  counter:          { fontSize: 11, color: COLORS.gray },

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
  modalTitle:       { fontSize: FONT.lg, fontWeight: '800', color: COLORS.dark, marginBottom: SPACING.sm },
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