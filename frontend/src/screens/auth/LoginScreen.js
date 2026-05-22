import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView,
  Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../context/AuthContext';
import { COLORS, SPACING, RADIUS, FONT } from '../../constants/theme';

export default function LoginScreen({ navigation }) {
  const { signIn } = useAuth();

  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Campos requeridos', 'Por favor ingresa tu correo y contraseña.');
      return;
    }

    setLoading(true);
    try {
      await signIn(email.trim().toLowerCase(), password);
      // AppNavigator reacts to auth state — no manual navigation needed
    } catch (error) {
      const msg = firebaseErrorMessage(error.code);
      Alert.alert('Error al iniciar sesión', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">

          {/* Header */}
          <View style={styles.header}>
            <Icon name="car-sport" size={52} color={COLORS.primary} />
            <Text style={styles.title}>Bienvenido</Text>
            <Text style={styles.subtitle}>Inicia sesión para continuar</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>

            <View style={styles.field}>
              <Text style={styles.label}>Correo electrónico *</Text>
              <TextInput
                style={styles.input}
                placeholder="ejemplo@correo.com"
                placeholderTextColor={COLORS.gray}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Contraseña *</Text>
              <View style={styles.passwordRow}>
                <TextInput
                  style={[styles.input, styles.passwordInput]}
                  placeholder="••••••••"
                  placeholderTextColor={COLORS.gray}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPass(v => !v)}
                >
                  <Icon
                    name={showPass ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={COLORS.gray}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading
                ? <ActivityIndicator color={COLORS.white} />
                : <Text style={styles.primaryButtonText}>Iniciar sesión</Text>
              }
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>o</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => navigation.navigate('Register')}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonText}>Crear cuenta nueva</Text>
            </TouchableOpacity>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Map Firebase error codes to readable Spanish messages
function firebaseErrorMessage(code) {
  const map = {
    'auth/user-not-found':      'No existe una cuenta con ese correo.',
    'auth/wrong-password':      'Contraseña incorrecta.',
    'auth/invalid-email':       'El correo ingresado no es válido.',
    'auth/too-many-requests':   'Demasiados intentos. Intenta más tarde.',
    'auth/network-request-failed': 'Sin conexión. Verifica tu red.',
    'auth/invalid-credential':  'Correo o contraseña incorrectos.',
  };
  return map[code] || 'Ocurrió un error. Intenta de nuevo.';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  title: {
    fontSize: FONT.xxl,
    fontWeight: '800',
    color: COLORS.dark,
    marginTop: SPACING.sm,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: FONT.base,
    color: COLORS.gray,
    marginTop: SPACING.xs,
  },
  form: {
    width: '100%',
  },
  field: {
    marginBottom: SPACING.sm + 8,
  },
  label: {
    fontSize: FONT.base,
    fontWeight: '600',
    color: COLORS.dark,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: SPACING.sm,
    fontSize: FONT.base,
    color: COLORS.black,
    backgroundColor: COLORS.inputBg,
  },
  passwordRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordInput: {
    flex: 1,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  eyeButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderLeftWidth: 0,
    borderTopRightRadius: RADIUS.sm,
    borderBottomRightRadius: RADIUS.sm,
    paddingHorizontal: 12,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.inputBg,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
    marginTop: SPACING.xs,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: FONT.md,
    fontWeight: '700',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.md,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    marginHorizontal: SPACING.sm,
    color: COLORS.gray,
    fontSize: FONT.base,
  },
  secondaryButton: {
    borderWidth: 2,
    borderColor: COLORS.primary,
    paddingVertical: 14,
    borderRadius: RADIUS.sm,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: COLORS.primary,
    fontSize: FONT.md,
    fontWeight: '700',
  },
});
