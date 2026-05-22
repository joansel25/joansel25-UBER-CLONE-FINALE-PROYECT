import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, KeyboardAvoidingView, Platform, ScrollView,
  Modal, FlatList, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import auth from '@react-native-firebase/auth';
import { useAuth } from '../../context/AuthContext';
import userApi from '../../api/userApi';
import { COLORS, SPACING, RADIUS, FONT } from '../../constants/theme';

const GENDER_OPTIONS = [
  { label: 'Masculino', value: 'male' },
  { label: 'Femenino',  value: 'female' },
  { label: 'Otro',      value: 'other' },
];

const LANGUAGE_OPTIONS = [
  { label: 'Español', value: 'ES' },
  { label: 'English', value: 'EN' },
];

export default function RegisterScreen({ navigation }) {
  const { refreshUser } = useAuth();

  const [form, setForm] = useState({
    fullName: '',
    email:    '',
    phone:    '',
    password: '',
    confirm:  '',
    gender:   '',
    language: 'ES',
  });
  const [showPass,        setShowPass]        = useState(false);
  const [showConfirm,     setShowConfirm]     = useState(false);
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [loading,         setLoading]         = useState(false);

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }));

  const validate = () => {
    if (!form.fullName.trim() || form.fullName.trim().length < 3) {
      Alert.alert('Error', 'El nombre debe tener al menos 3 caracteres.'); return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      Alert.alert('Error', 'Correo electrónico inválido.'); return false;
    }
    if (!/^\d{7,}$/.test(form.phone)) {
      Alert.alert('Error', 'El teléfono debe tener al menos 7 dígitos.'); return false;
    }
    if (!form.gender) {
      Alert.alert('Error', 'Selecciona un género.'); return false;
    }
    if (form.password.length < 6) {
      Alert.alert('Error', 'La contraseña debe tener al menos 6 caracteres.'); return false;
    }
    if (form.password !== form.confirm) {
      Alert.alert('Error', 'Las contraseñas no coinciden.'); return false;
    }
    return true;
  };

  const handleRegister = async () => {
    if (!validate()) return;
    setLoading(true);

    try {
      // 1. Create Firebase Auth account
      const credential = await auth().createUserWithEmailAndPassword(
        form.email.trim().toLowerCase(),
        form.password
      );
      const { uid } = credential.user;

      // 2. Register user profile in MongoDB backend
      //    api/client.js interceptor will attach the Firebase token automatically
      await userApi.register({
        fullName:    form.fullName.trim(),
        email:       form.email.trim().toLowerCase(),
        phone:       form.phone.trim(),
        gender:      form.gender,
        language:    form.language,
        firebaseUid: uid,
        role:        'passenger',
      });

      // 3. Pull the newly created profile into AuthContext
      await refreshUser();
      // AppNavigator will react to dbUser being set → navigates to Main automatically

    } catch (error) {
      // If backend registration fails after Firebase account was created,
      // delete the Firebase account to keep both stores consistent
      const fbUser = auth().currentUser;
      if (fbUser && error.statusCode) {
        await fbUser.delete().catch(() => null);
      }
      const msg = firebaseErrorMessage(error.code) || error.message || 'Error al registrarse.';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const genderLabel = GENDER_OPTIONS.find(o => o.value === form.gender)?.label || 'Seleccionar';

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Crear cuenta</Text>
            <Text style={styles.subtitle}>Todos los campos con * son obligatorios</Text>
          </View>

          {/* Full Name */}
          <View style={styles.field}>
            <Text style={styles.label}>Nombre completo *</Text>
            <TextInput
              style={styles.input}
              placeholder="Tu nombre completo"
              placeholderTextColor={COLORS.gray}
              value={form.fullName}
              onChangeText={v => set('fullName', v.length <= 50 ? v : form.fullName)}
              maxLength={50}
            />
            <Text style={styles.counter}>{form.fullName.length}/50</Text>
          </View>

          {/* Email */}
          <View style={styles.field}>
            <Text style={styles.label}>Correo electrónico *</Text>
            <TextInput
              style={styles.input}
              placeholder="ejemplo@correo.com"
              placeholderTextColor={COLORS.gray}
              value={form.email}
              onChangeText={v => set('email', v)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {/* Phone */}
          <View style={styles.field}>
            <Text style={styles.label}>Teléfono *</Text>
            <TextInput
              style={styles.input}
              placeholder="3001234567"
              placeholderTextColor={COLORS.gray}
              value={form.phone}
              onChangeText={v => set('phone', v.replace(/[^0-9]/g, ''))}
              keyboardType="numeric"
            />
          </View>

          {/* Gender */}
          <View style={styles.field}>
            <Text style={styles.label}>Género *</Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setShowGenderModal(true)}
            >
              <Text style={[styles.dropdownText, !form.gender && { color: COLORS.gray }]}>
                {genderLabel}
              </Text>
              <Icon name="chevron-down" size={14} color={COLORS.gray} />
            </TouchableOpacity>
          </View>

          {/* Language */}
          <View style={styles.field}>
            <Text style={styles.label}>Idioma preferido</Text>
            <View style={styles.languageRow}>
              {LANGUAGE_OPTIONS.map(lang => (
                <TouchableOpacity
                  key={lang.value}
                  style={[styles.langButton, form.language === lang.value && styles.langButtonActive]}
                  onPress={() => set('language', lang.value)}
                >
                  <Text style={[styles.langText, form.language === lang.value && styles.langTextActive]}>
                    {lang.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Password */}
          <View style={styles.field}>
            <Text style={styles.label}>Contraseña * (mín. 6 caracteres)</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="••••••••"
                placeholderTextColor={COLORS.gray}
                value={form.password}
                onChangeText={v => set('password', v)}
                secureTextEntry={!showPass}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowPass(v => !v)}>
                <Icon name={showPass ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.gray} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Confirm Password */}
          <View style={styles.field}>
            <Text style={styles.label}>Confirmar contraseña *</Text>
            <View style={styles.passwordRow}>
              <TextInput
                style={[styles.input, styles.passwordInput]}
                placeholder="••••••••"
                placeholderTextColor={COLORS.gray}
                value={form.confirm}
                onChangeText={v => set('confirm', v)}
                secureTextEntry={!showConfirm}
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.eyeBtn} onPress={() => setShowConfirm(v => !v)}>
                <Icon name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={20} color={COLORS.gray} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color={COLORS.white} />
              : <Text style={styles.submitButtonText}>Registrarse</Text>
            }
          </TouchableOpacity>

          {/* Back to Login */}
          {navigation && (
            <TouchableOpacity
              style={styles.loginLink}
              onPress={() => navigation.navigate('Login')}
            >
              <Text style={styles.loginLinkText}>
                ¿Ya tienes cuenta? <Text style={styles.loginLinkBold}>Inicia sesión</Text>
              </Text>
            </TouchableOpacity>
          )}

        </ScrollView>
      </KeyboardAvoidingView>

      {/* Gender Modal */}
      <Modal
        visible={showGenderModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGenderModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowGenderModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Seleccionar género</Text>
            <FlatList
              data={GENDER_OPTIONS}
              keyExtractor={item => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.optionBtn}
                  onPress={() => { set('gender', item.value); setShowGenderModal(false); }}
                >
                  <Text style={[styles.optionText, form.gender === item.value && styles.optionTextActive]}>
                    {item.label}
                  </Text>
                  {form.gender === item.value && (
                    <Icon name="checkmark" size={18} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

    </SafeAreaView>
  );
}

function firebaseErrorMessage(code) {
  const map = {
    'auth/email-already-in-use': 'Ya existe una cuenta con ese correo.',
    'auth/invalid-email':        'El correo ingresado no es válido.',
    'auth/weak-password':        'La contraseña es muy débil.',
    'auth/network-request-failed': 'Sin conexión. Verifica tu red.',
  };
  return map[code];
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: COLORS.white },
  scroll:     { flexGrow: 1, paddingHorizontal: SPACING.lg, paddingVertical: SPACING.md },
  header:     { paddingTop: SPACING.sm, paddingBottom: SPACING.md },
  title:      { fontSize: FONT.xxl, fontWeight: '800', color: COLORS.dark, letterSpacing: -0.5 },
  subtitle:   { fontSize: FONT.base, color: COLORS.gray, marginTop: SPACING.xs },
  field:      { marginBottom: SPACING.sm + 8 },
  label:      { fontSize: FONT.base, fontWeight: '600', color: COLORS.dark, marginBottom: 8 },
  counter:    { fontSize: FONT.sm, color: COLORS.gray, marginTop: 4 },
  input: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm,
    paddingHorizontal: 12, paddingVertical: SPACING.sm,
    fontSize: FONT.base, color: COLORS.black, backgroundColor: COLORS.inputBg,
  },
  dropdown: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm,
    paddingHorizontal: 12, paddingVertical: 12, backgroundColor: COLORS.inputBg,
  },
  dropdownText: { fontSize: FONT.base, color: COLORS.black },
  languageRow:  { flexDirection: 'row', gap: 12 },
  langButton: {
    flex: 1, paddingVertical: 10, borderWidth: 2, borderColor: COLORS.border,
    borderRadius: RADIUS.sm, alignItems: 'center', backgroundColor: COLORS.inputBg,
  },
  langButtonActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  langText:         { fontSize: FONT.base, fontWeight: '600', color: COLORS.dark },
  langTextActive:   { color: COLORS.white },
  passwordRow:  { flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1, borderTopRightRadius: 0, borderBottomRightRadius: 0 },
  eyeBtn: {
    borderWidth: 1, borderColor: COLORS.border, borderLeftWidth: 0,
    borderTopRightRadius: RADIUS.sm, borderBottomRightRadius: RADIUS.sm,
    paddingHorizontal: 12, paddingVertical: SPACING.sm, backgroundColor: COLORS.inputBg,
  },
  submitButton: {
    backgroundColor: COLORS.success, paddingVertical: 14,
    borderRadius: RADIUS.sm, alignItems: 'center', marginTop: SPACING.xs, marginBottom: SPACING.sm,
  },
  buttonDisabled: { opacity: 0.5 },
  submitButtonText: { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },
  loginLink:     { alignItems: 'center', paddingVertical: SPACING.sm },
  loginLinkText: { fontSize: FONT.base, color: COLORS.gray },
  loginLinkBold: { color: COLORS.primary, fontWeight: '700' },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: SPACING.md,
  },
  modalContent: {
    width: '100%', backgroundColor: COLORS.white,
    borderRadius: RADIUS.md, padding: SPACING.md, maxHeight: '50%',
  },
  modalTitle: {
    fontSize: FONT.lg, fontWeight: 'bold', color: COLORS.dark,
    marginBottom: SPACING.sm, textAlign: 'center',
  },
  optionBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: COLORS.lightGray,
  },
  optionText:       { fontSize: FONT.md, color: COLORS.dark },
  optionTextActive: { color: COLORS.primary, fontWeight: '700' },
});
