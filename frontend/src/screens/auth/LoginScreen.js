import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon        from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../../context/AuthContext';
import { useTranslation } from '../../hooks/useTranslation';
import ErrorBanner from '../../components/common/ErrorBanner';
import logger      from '../../utils/logger';
import { COLORS, SPACING, RADIUS, FONT, SHADOW } from '../../constants/theme';

export default function LoginScreen({ navigation }) {
  const { signIn, resetPassword } = useAuth();
  const { t } = useTranslation();

  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [showPass,    setShowPass]    = useState(false);
  const [loading,     setLoading]     = useState(false);
  const [resetting,   setResetting]   = useState(false);
  const [error,       setError]       = useState('');
  const [debugCode,   setDebugCode]   = useState('');

  const handleEmailChange    = v => { setError(''); setDebugCode(''); setEmail(v); };
  const handlePasswordChange = v => { setError(''); setDebugCode(''); setPassword(v); };

  const handleLogin = async () => {
    setError('');
    setDebugCode('');

    if (!email.trim()) {
      setError(t('login_no_email'));
      return;
    }
    if (!password) {
      setError(t('login_no_pass'));
      return;
    }

    setLoading(true);
    const normalizedEmail = email.trim().toLowerCase();
    logger.step('Login', `Intentando login: ${normalizedEmail}`);
    try {
      await signIn(normalizedEmail, password);
      logger.ok('Login', 'Firebase auth OK — waiting for AuthContext…');
      // onAuthStateChanged takes over from here
    } catch (err) {
      logger.error('Login', `Failed — code:${err.code} | message:${err.message}`);
      setDebugCode(err.code ?? 'no_code');
      setError(friendlyMessage(err.code, t));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    const emailToReset = email.trim().toLowerCase();
    if (!emailToReset) {
      setError(t('login_write_email'));
      return;
    }

    setResetting(true);
    logger.step('Login', `Sending password reset to: ${emailToReset}`);
    try {
      await resetPassword(emailToReset);
      logger.ok('Login', 'Email de reset enviado');
      Alert.alert(
        t('login_reset_title'),
        t('login_reset_msg', emailToReset),
        [{ text: t('login_reset_btn'), style: 'default' }]
      );
    } catch (err) {
      logger.error('Login', `Reset failed — code:${err.code} | ${err.message}`);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-email') {
        setError(t('login_no_account'));
      } else {
        setError(t('login_reset_fail'));
      }
    } finally {
      setResetting(false);
    }
  };

  const isDisabled = loading || resetting || !email.trim() || !password;

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
            <Text style={styles.title}>{t('login_title')}</Text>
            <Text style={styles.subtitle}>{t('login_subtitle')}</Text>
          </View>

          {/* ── Form card ── */}
          <View style={styles.card}>

            <ErrorBanner message={error} onDismiss={() => { setError(''); setDebugCode(''); }} />

            {/* Debug code visible en desarrollo */}
            {__DEV__ && debugCode ? (
              <View style={styles.debugRow}>
                <Icon name="bug-outline" size={13} color="#888" />
                <Text style={styles.debugText}>Firebase code: {debugCode}</Text>
              </View>
            ) : null}

            {/* Email */}
            <View style={styles.field}>
              <Text style={styles.label}>{t('login_email_label')}</Text>
              <View style={styles.inputRow}>
                <Icon name="mail-outline" size={18} color={COLORS.gray} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder={t('login_email_ph')}
                  placeholderTextColor={COLORS.gray}
                  value={email}
                  onChangeText={handleEmailChange}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading && !resetting}
                />
              </View>
            </View>

            {/* Password */}
            <View style={styles.field}>
              <Text style={styles.label}>{t('login_pass_label')}</Text>
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
                  editable={!loading && !resetting}
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

            {/* Forgot password */}
            <TouchableOpacity
              style={styles.forgotBtn}
              onPress={handleForgotPassword}
              disabled={loading || resetting}
            >
              {resetting
                ? <ActivityIndicator size="small" color={COLORS.primary} />
                : <Text style={styles.forgotText}>{t('login_forgot')}</Text>
              }
            </TouchableOpacity>

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
                    <Text style={styles.primaryBtnText}>{t('login_btn')}</Text>
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
              disabled={loading || resetting}
              activeOpacity={0.85}
            >
              <Icon name="person-add-outline" size={18} color={COLORS.primary} />
              <Text style={styles.secondaryBtnText}>{t('login_create')}</Text>
            </TouchableOpacity>

          </View>

          <Text style={styles.footer}>{t('login_footer')}</Text>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function friendlyMessage(code, t) {
  const map = {
    'auth/user-not-found':        t('login_err_not_found'),
    'auth/wrong-password':        t('login_err_wrong_pass'),
    'auth/invalid-email':         t('login_err_invalid_email'),
    'auth/invalid-credential':    t('login_err_invalid_cred'),
    'auth/too-many-requests':     t('login_err_too_many'),
    'auth/user-disabled':         t('login_err_disabled'),
    'auth/network-request-failed':t('login_err_network'),
  };
  return map[code] ?? t('login_err_default');
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

  debugRow: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: '#1a1a2e', borderRadius: 6, padding: 8, marginBottom: 8,
  },
  debugText: { fontSize: 11, color: '#aaa', fontFamily: 'monospace' },

  field:    { marginBottom: SPACING.sm + 4 },
  label:    { fontSize: FONT.sm, fontWeight: '600', color: COLORS.gray, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },

  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: COLORS.border,
    borderRadius: RADIUS.sm, paddingHorizontal: 12,
    backgroundColor: COLORS.inputBg, height: 50,
  },
  inputIcon: { marginRight: 10 },
  input:     { flex: 1, fontSize: FONT.base, color: COLORS.dark },

  forgotBtn:  { alignSelf: 'flex-end', marginBottom: SPACING.sm, minHeight: 24, justifyContent: 'center' },
  forgotText: { fontSize: FONT.sm, color: COLORS.primary, fontWeight: '600' },

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