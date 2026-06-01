import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator, Switch,
} from 'react-native';
import CountryFlag    from 'react-native-country-flag';
import Icon           from 'react-native-vector-icons/Ionicons';
import { useTranslation } from '../../hooks/useTranslation';
import { useTheme }   from '../../context/ThemeContext';

const LANGUAGES = [
  { label: 'Español', value: 'ES', isoCode: 'CO' },
  { label: 'English', value: 'EN', isoCode: 'GB' },
];

export default function PreferencesTab({
  formData       = { language: 'ES', fullName: '', phone: '', email: '' },
  updateFormData = () => {},
  onSave         = () => {},
  isSaving       = false,
}) {
  const { t } = useTranslation();
  const { isDark, toggleTheme, colors } = useTheme();
  const s = makeStyles(colors);

  const handleSave = () => onSave({ language: formData.language });

  return (
    <View style={s.container}>
      <Text style={s.title}>{t('prefs_title')}</Text>

      {/* Dark / Light mode toggle */}
      <View style={s.field}>
        <Text style={s.label}>Apariencia</Text>
        <Text style={s.description}>Elige entre modo claro u oscuro para toda la app</Text>

        <View style={s.themeRow}>
          <Icon
            name={isDark ? 'moon' : 'sunny'}
            size={22}
            color={isDark ? colors.primary : '#FF9500'}
          />
          <Text style={s.themeLabel}>{isDark ? 'Modo oscuro activo' : 'Modo claro activo'}</Text>
          <Switch
            value={isDark}
            onValueChange={toggleTheme}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={isDark ? colors.primary : '#f4f3f4'}
          />
        </View>
      </View>

      {/* Language selector */}
      <View style={s.field}>
        <Text style={s.label}>{t('prefs_lang_label')}</Text>
        <Text style={s.description}>{t('prefs_lang_desc')}</Text>

        <View style={s.languageButtons}>
          {LANGUAGES.map(lang => (
            <TouchableOpacity
              key={lang.value}
              style={[
                s.languageButton,
                formData.language === lang.value && s.languageButtonActive,
              ]}
              onPress={() => updateFormData('language', lang.value)}
              activeOpacity={0.8}
            >
              <CountryFlag isoCode={lang.isoCode} size={18} style={s.flag} />
              <Text style={[
                s.languageButtonText,
                formData.language === lang.value && s.languageButtonTextActive,
              ]}>
                {lang.label}
              </Text>
              {formData.language === lang.value && (
                <Icon name="checkmark-circle" size={16} color="#fff" />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Preview */}
      <View style={s.previewBox}>
        <Text style={s.previewTitle}>{t('prefs_preview_title')}</Text>
        <View style={s.previewContent}>
          <Text style={s.previewText}>{t('prefs_preview_name',  formData.fullName)}</Text>
          <Text style={s.previewText}>{t('prefs_preview_phone', formData.phone)}</Text>
          <Text style={s.previewText}>{t('prefs_preview_email', formData.email)}</Text>
          <Text style={s.previewText}>{t('prefs_preview_lang')}</Text>
        </View>
      </View>

      {/* Save button */}
      <TouchableOpacity
        style={[s.saveButton, isSaving && s.saveButtonDisabled]}
        onPress={handleSave}
        disabled={isSaving}
        activeOpacity={0.8}
      >
        {isSaving
          ? <ActivityIndicator color="#fff" />
          : <Text style={s.saveButtonText}>{t('prefs_save')}</Text>
        }
      </TouchableOpacity>

      {/* Account info */}
      <View style={s.infoBox}>
        <Text style={s.infoTitle}>{t('prefs_about')}</Text>
        <Text style={s.infoText}>
          <Icon name="information-circle-outline" size={13} color={colors.primary} />
          {t('prefs_info1')}
        </Text>
        <Text style={s.infoText}>
          <Icon name="information-circle-outline" size={13} color={colors.primary} />
          {t('prefs_info2')}
        </Text>
      </View>
    </View>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 20, paddingTop: 10, backgroundColor: colors.surface },
    title:     { fontSize: 18, fontWeight: 'bold', marginBottom: 20, color: colors.textPrimary },
    field:     { marginBottom: 24 },
    label:     { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 },
    description: { fontSize: 13, color: colors.textSecondary, marginBottom: 12 },

    themeRow: {
      flexDirection: 'row', alignItems: 'center', gap: 12,
      backgroundColor: colors.inputBg, borderRadius: 10,
      padding: 12, borderWidth: 1, borderColor: colors.border,
    },
    themeLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textPrimary },

    languageButtons: { flexDirection: 'row', gap: 12 },
    languageButton: {
      flex: 1, flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 14,
      borderWidth: 2, borderColor: colors.border, borderRadius: 8,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.inputBg, gap: 8,
    },
    languageButtonActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    flag:                 { borderRadius: 2 },
    languageButtonText:   { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
    languageButtonTextActive: { color: '#fff' },

    previewBox: {
      backgroundColor: colors.infoBox, borderLeftWidth: 4,
      borderLeftColor: colors.primary, padding: 14,
      borderRadius: 8, marginBottom: 24,
    },
    previewTitle:   { fontSize: 13, fontWeight: '700', color: colors.primary, marginBottom: 10 },
    previewContent: { gap: 6 },
    previewText:    { fontSize: 12, color: colors.textPrimary },

    saveButton: {
      backgroundColor: colors.success, paddingVertical: 14,
      borderRadius: 8, alignItems: 'center',
      marginBottom: 20,
    },
    saveButtonDisabled: { opacity: 0.55 },
    saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    infoBox: {
      backgroundColor: colors.infoBox, borderLeftWidth: 4,
      borderLeftColor: colors.primary, padding: 14,
      borderRadius: 8, marginBottom: 30, gap: 8,
    },
    infoTitle: { fontSize: 13, fontWeight: '700', color: colors.primary, marginBottom: 4 },
    infoText:  { fontSize: 12, color: colors.textPrimary },
  });
}
