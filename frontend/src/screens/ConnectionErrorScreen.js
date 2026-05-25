import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon     from 'react-native-vector-icons/Ionicons';
import Config   from 'react-native-config';
import { useAuth } from '../context/AuthContext';
import { useTranslation } from '../hooks/useTranslation';
import { COLORS, SPACING, FONT, RADIUS, SHADOW } from '../constants/theme';

export default function ConnectionErrorScreen() {
  const { signOut, refreshUser } = useAuth();
  const { t } = useTranslation();
  const [retrying, setRetrying] = useState(false);
  const [error,    setError]    = useState('');

  const handleRetry = async () => {
    setRetrying(true);
    setError('');
    try {
      await refreshUser();
    } catch {
      setError(t('conn_error'));
    } finally {
      setRetrying(false);
    }
  };

  const apiUrl = Config.API_URL || '(no configurada)';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Icon name="cloud-offline-outline" size={52} color={COLORS.danger} />
        </View>

        <Text style={styles.title}>{t('conn_title')}</Text>
        <Text style={styles.body}>{t('conn_body')}</Text>

        <View style={styles.debugBox}>
          <Text style={styles.debugLabel}>{t('conn_api_label')}</Text>
          <Text style={styles.debugValue}>{apiUrl}</Text>
          <Text style={styles.debugHint}>
            {apiUrl.includes('10.0.2.2')
              ? '✓ Correcto para emulador Android'
              : apiUrl.includes('localhost')
                ? '⚠ localhost no funciona en el emulador — usa 10.0.2.2'
                : '⚠ IP personalizada — asegúrate que el backend esté corriendo en esa dirección'}
          </Text>
        </View>

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <TouchableOpacity
          style={[styles.btn, retrying && styles.btnDisabled]}
          onPress={handleRetry}
          disabled={retrying}
          activeOpacity={0.85}
        >
          {retrying
            ? <ActivityIndicator color={COLORS.white} size="small" />
            : <>
                <Icon name="refresh-outline" size={18} color={COLORS.white} />
                <Text style={styles.btnText}>{t('conn_retry')}</Text>
              </>
          }
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.logoutBtn}
          onPress={() => { signOut().catch(() => {}); }}
          disabled={retrying}
          activeOpacity={0.85}
        >
          <Icon name="log-out-outline" size={16} color={COLORS.danger} />
          <Text style={styles.logoutText}>{t('conn_logout')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F7FA',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: SPACING.lg,
    alignItems: 'center',
    ...SHADOW.card,
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  iconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: '#FFF0F0',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: FONT.xl,
    fontWeight: '800',
    color: COLORS.dark,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  body: {
    fontSize: FONT.base,
    color: COLORS.gray,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.md,
  },
  debugBox: {
    width: '100%',
    backgroundColor: '#1a1a2e',
    borderRadius: RADIUS.sm,
    padding: SPACING.sm,
    marginBottom: SPACING.md,
  },
  debugLabel: {
    fontSize: 11,
    color: '#888',
    marginBottom: 4,
    fontFamily: 'monospace',
  },
  debugValue: {
    fontSize: 13,
    color: '#00ff88',
    fontFamily: 'monospace',
    fontWeight: '700',
    marginBottom: 6,
  },
  debugHint: {
    fontSize: 11,
    color: '#aaa',
    fontFamily: 'monospace',
  },
  errorText: {
    fontSize: FONT.sm,
    color: COLORS.danger,
    textAlign: 'center',
    marginBottom: SPACING.sm,
  },
  btn: {
    backgroundColor: COLORS.primary,
    height: 50,
    borderRadius: RADIUS.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    marginBottom: SPACING.sm,
  },
  btnDisabled: { opacity: 0.55 },
  btnText: {
    color: COLORS.white,
    fontSize: FONT.md,
    fontWeight: '700',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: SPACING.sm,
  },
  logoutText: {
    color: COLORS.danger,
    fontSize: FONT.base,
    fontWeight: '600',
  },
});
