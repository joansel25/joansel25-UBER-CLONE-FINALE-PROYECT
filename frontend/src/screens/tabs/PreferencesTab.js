import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ActivityIndicator,
} from 'react-native';
import CountryFlag from 'react-native-country-flag';
import Icon       from 'react-native-vector-icons/Ionicons';

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
  const handleSave = () => onSave({ language: formData.language });

  const isES = formData.language === 'ES';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Preferencias</Text>

      {/* Language selector */}
      <View style={styles.field}>
        <Text style={styles.label}>Idioma preferido *</Text>
        <Text style={styles.description}>
          {isES
            ? 'Selecciona el idioma de la aplicación'
            : 'Select the application language'}
        </Text>

        <View style={styles.languageButtons}>
          {LANGUAGES.map(lang => (
            <TouchableOpacity
              key={lang.value}
              style={[
                styles.languageButton,
                formData.language === lang.value && styles.languageButtonActive,
              ]}
              onPress={() => updateFormData('language', lang.value)}
              activeOpacity={0.8}
            >
              <CountryFlag isoCode={lang.isoCode} size={18} style={styles.flag} />
              <Text style={[
                styles.languageButtonText,
                formData.language === lang.value && styles.languageButtonTextActive,
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

      {/* Preview — matches Carlos's original behaviour */}
      <View style={styles.previewBox}>
        <Text style={styles.previewTitle}>
          {isES ? 'Vista previa — Español' : 'Preview — English'}
        </Text>
        <View style={styles.previewContent}>
          <Text style={styles.previewText}>
            {isES ? `✓ Nombre: ${formData.fullName || 'Sin ingresar'}`
                  : `✓ Name: ${formData.fullName || 'Not entered'}`}
          </Text>
          <Text style={styles.previewText}>
            {isES ? `✓ Teléfono: ${formData.phone || 'Sin ingresar'}`
                  : `✓ Phone: ${formData.phone || 'Not entered'}`}
          </Text>
          <Text style={styles.previewText}>
            {isES ? `✓ Correo: ${formData.email || 'Sin ingresar'}`
                  : `✓ Email: ${formData.email || 'Not entered'}`}
          </Text>
          <Text style={styles.previewText}>
            {isES ? '✓ Idioma: Español' : '✓ Language: English'}
          </Text>
        </View>
      </View>

      {/* Save button */}
      <TouchableOpacity
        style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={isSaving}
        activeOpacity={0.8}
      >
        {isSaving
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.saveButtonText}>
              {isES ? 'Guardar preferencias' : 'Save preferences'}
            </Text>
        }
      </TouchableOpacity>

      {/* Account info */}
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>
          {isES ? 'Sobre tu cuenta' : 'About your account'}
        </Text>
        <Text style={styles.infoText}>
          <Icon name="information-circle-outline" size={13} color="#007AFF" />
          {isES
            ? '  El correo y el género no son editables.'
            : '  Email and gender cannot be changed.'}
        </Text>
        <Text style={styles.infoText}>
          <Icon name="information-circle-outline" size={13} color="#007AFF" />
          {isES
            ? '  Nombre, teléfono e idioma sí pueden actualizarse.'
            : '  Full name, phone and language can be updated.'}
        </Text>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, paddingHorizontal: 20, paddingTop: 10, backgroundColor: '#fff' },
  title:       { fontSize: 18, fontWeight: 'bold', marginBottom: 20, color: '#000' },
  field:       { marginBottom: 24 },
  label:       { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  description: { fontSize: 13, color: '#666', marginBottom: 12 },

  languageButtons: { flexDirection: 'row', gap: 12 },
  languageButton: {
    flex: 1, flexDirection: 'row', paddingVertical: 12, paddingHorizontal: 14,
    borderWidth: 2, borderColor: '#ddd', borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#f9f9f9', gap: 8,
  },
  languageButtonActive: { backgroundColor: '#007AFF', borderColor: '#007AFF' },
  flag:                 { borderRadius: 2 },
  languageButtonText:   { fontSize: 14, fontWeight: '600', color: '#333' },
  languageButtonTextActive: { color: '#fff' },

  previewBox: {
    backgroundColor: '#F0F8FF', borderLeftWidth: 4,
    borderLeftColor: '#007AFF', padding: 14,
    borderRadius: 8, marginBottom: 24,
  },
  previewTitle:   { fontSize: 13, fontWeight: '700', color: '#007AFF', marginBottom: 10 },
  previewContent: { gap: 6 },
  previewText:    { fontSize: 12, color: '#333' },

  saveButton: {
    backgroundColor: '#34C759', paddingVertical: 14,
    borderRadius: 8, alignItems: 'center',
    marginBottom: 20,
  },
  saveButtonDisabled: { backgroundColor: '#A5D6A7' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  infoBox: {
    backgroundColor: '#E3F2FD', borderLeftWidth: 4,
    borderLeftColor: '#007AFF', padding: 14,
    borderRadius: 8, marginBottom: 30, gap: 8,
  },
  infoTitle: { fontSize: 13, fontWeight: '700', color: '#007AFF', marginBottom: 4 },
  infoText:  { fontSize: 12, color: '#333' },
});
