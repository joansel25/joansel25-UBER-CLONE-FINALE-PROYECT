import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon        from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../context/AuthContext';
import ErrorBanner from '../../components/common/ErrorBanner';
import { COLORS, SPACING, RADIUS, FONT, SHADOW } from '../../constants/theme';

export default function LoginScreen({ navigation }) {
  const { signIn } = useAuth();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  // Clear error as soon as the user edits any field
  const handleEmailChange = v    => { setError(''); setEmail(v); };
  const handlePasswordChange = v => { setError(''); setPassword(v); };

  const handleLogin = async () => {
    setError('');

    if (!email.trim()) {
      setError('Ingresa tu correo electrónico para continuar.');
      return;
    }
    if (!password) {
      setError('Ingresa tu contraseña para continuar.');
      return;
    }

    setLoading(true);
    try {
      await signIn(email.trim().toLowerCase(), password);
      // AppNavigator reacts automatically — no manual navigation needed
    } catch (err) {
      setError(friendlyMessage(err.code));
    } finally {
      setLoading(false);
    }
  };

  const isDisabled = loading || !email.trim() || !password;

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
          {/* ── Logo / Header ── */}
          <View style={styles.header}>
            <View style={styles.logoCircle}>
              <Icon name="car-sport" size={36} color={COLORS.white} />
            </View>
            <Text style={styles.title}>Bienvenido</Text>
            <Text style={styles.subtitle}>Inicia sesión para continuar</Text>
          </View>

          {/* ── Form card ── */}
          <View style={styles.card}>

            {/* Error banner — animated, no Alert pop-up */}
            <ErrorBanner message={error} onDismiss={() => setError('')} />

            {/* Email */}
            <View style={styles.field}>
              <Text style={styles.label}>Correo electrónico</Text>
              <View style={[styles.inputRow, error && !password && styles.inputRowError]}>
                <Icon name="mail-outline" size={18} color={COLORS.gray} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="ejemplo@correo.com"
                  placeholderTextColor={COLORS.gray}
                  value={email}
                  onChangeText={handleEmailChange}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.field}>
              <Text style={styles.label}>Contraseña</Text>
              <View style={styles.inputRow}>
                <Icon name="lock-closed-outline" size={18} color={COLORS.gray} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={COLORS.gray}
                  value={password}
                  onChangeText={handlePasswordChange}
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                  editable={!loading}
                />
                <TouchableOpacity
                  onPress={() => setShowPass(v => !v)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Icon
                    name={showPass ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={COLORS.gray}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Login button */}
            <TouchableOpacity
              style={[styles.primaryBtn, isDisabled && styles.btnDisabled]}
              onPress={handleLogin}
              disabled={isDisabled}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color={COLORS.white} size="small" />
                : <>
                    <Icon name="log-in-outline" size={18} color={COLORS.white} />
                    <Text style={styles.primaryBtnText}>Iniciar sesión</Text>
                  </>
              }
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>o</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Register link */}
            <TouchableOpacity
              style={styles.secondaryBtn}
              onPress={() => navigation.navigate('Register')}
              disabled={loading}
              activeOpacity={0.85}
            >
              <Icon name="person-add-outline" size={18} color={COLORS.primary} />
              <Text style={styles.secondaryBtnText}>Crear cuenta nueva</Text>
            </TouchableOpacity>

          </View>

          {/* Footer note */}
          <Text style={styles.footer}>
            Al continuar aceptas nuestros Términos de Uso y Política de Privacidad.
          </Text>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── All Firebase error codes → friendly Spanish messages ──────────────────────
function friendlyMessage(code) {
  const map = {
    'auth/user-not-found':
      'No encontramos ninguna cuenta con ese correo. ¿Quieres crear una?',
    'auth/wrong-password':
      'La contraseña es incorrecta. Verifica e intenta de nuevo.',
    'auth/invalid-email':
      'El formato del correo no es válido. Ejemplo: usuario@correo.com',
    'auth/invalid-credential':
      'El correo o la contraseña no coinciden. Verifica tus datos.',
    'auth/too-many-requests':
      'Tu cuenta fue bloqueada temporalmente por múltiples intentos fallidos. Intenta más tarde o restablece tu contraseña.',
    'auth/user-disabled':
      'Esta cuenta ha sido desactivada. Comunícate con soporte.',
    'auth/network-request-failed':
      'Sin conexión a internet. Verifica tu red e intenta de nuevo.',
    'auth/configuration-not':
      'El servicio de autenticación no está disponible en este momento. Verifica tu conexión e intenta de nuevo.',
    'auth/internal-error':
      'Ocurrió un problema interno. Por favor intenta de nuevo en unos segundos.',
    'auth/operation-not-allowed':
      'Este método de inicio de sesión no está habilitado. Contacta al administrador.',
  };
  return map[code] ?? 'Algo salió mal. Por favor intenta de nuevo.';
}

const styles = StyleSheet.create({
  container:  { flex: 1, backgroundColor: '#F5F7FA' },
  scroll:     { flexGrow: 1, justifyContent: 'center', padding: SPACING.lg },

  header:     { alignItems: 'center', marginBottom: SPACING.xl },
  logoCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: COLORS.primary,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: SPACING.sm,
    ...SHADOW.card,
  },
  title:    { fontSize: FONT.xxl, fontWeight: '800', color: COLORS.dark, letterSpacing: -0.5 },
  subtitle: { fontSize: FONT.base, color: COLORS.gray, marginTop: 6 },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: SPACING.md,
    ...SHADOW.card,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },

  field:    { marginBottom: SPACING.sm + 4 },
  label:    { fontSize: FONT.sm, fontWeight: '600', color: COLORS.gray, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },

  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.sm, paddingHorizontal: 12,
    backgroundColor: COLORS.inputBg, height: 50,
  },
  inputRowError: { borderColor: COLORS.danger },
  inputIcon:     { marginRight: 10 },
  input:         { flex: 1, fontSize: FONT.base, color: COLORS.dark },

  primaryBtn: {
    backgroundColor: COLORS.primary, height: 52,
    borderRadius: RADIUS.sm,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: SPACING.xs,
  },
  btnDisabled:     { opacity: 0.5 },
  primaryBtnText:  { color: COLORS.white, fontSize: FONT.md, fontWeight: '700' },

  divider:     { flexDirection: 'row', alignItems: 'center', marginVertical: SPACING.md },
  dividerLine: { flex: 1, height: 1, backgroundColor: COLORS.border },
  dividerText: { marginHorizontal: SPACING.sm, color: COLORS.gray, fontSize: FONT.sm },

  secondaryBtn: {
    borderWidth: 2, borderColor: COLORS.primary, height: 52,
    borderRadius: RADIUS.sm,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8,
  },
  secondaryBtnText: { color: COLORS.primary, fontSize: FONT.md, fontWeight: '700' },

  footer: {
    textAlign: 'center', fontSize: 11, color: COLORS.gray,
    marginTop: SPACING.lg, lineHeight: 16, paddingHorizontal: SPACING.sm,
  },
});
