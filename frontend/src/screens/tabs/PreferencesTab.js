import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import CountryFlag from 'react-native-country-flag';

export default function PreferencesTab({ formData = { language: 'ES', fullName: '', phone: '', email: '' }, updateFormData = () => {} }) {
  const languages = [
    { label: 'Spanish', value: 'ES', isoCode: 'ES' },
    { label: 'English', value: 'EN', isoCode: 'GB' },
  ];

  const handleLanguageChange = (language) => {
    updateFormData('language', language);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Preferences</Text>

      {/* Language Selection */}
      <View style={styles.field}>
        <Text style={styles.label}>Preferred Language *</Text>
        <Text style={styles.description}>
          Select the language for the application
        </Text>

        <View style={styles.languageButtons}>
          {languages.map((lang) => (
            <TouchableOpacity
              key={lang.value}
              style={[
                styles.languageButton,
                formData.language === lang.value &&
                  styles.languageButtonActive,
              ]}
              onPress={() => handleLanguageChange(lang.value)}
            >
              <CountryFlag isoCode={lang.isoCode} size={18} style={styles.flag} />
              <Text
                style={[
                  styles.languageButtonText,
                  formData.language === lang.value &&
                    styles.languageButtonTextActive,
                ]}
              >
                {lang.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Language Preview */}
      <View style={styles.previewBox}>
        <Text style={styles.previewTitle}>
          {formData.language === 'ES' ? 'Preview - Spanish' : 'Preview - English'}
        </Text>
        <View style={styles.previewContent}>
          {formData.language === 'ES' ? (
            <>
              <Text style={styles.previewText}>
                ✓ Nombre: {formData.fullName || 'No ingresado'}
              </Text>
              <Text style={styles.previewText}>
                ✓ Teléfono: {formData.phone || 'No ingresado'}
              </Text>
              <Text style={styles.previewText}>
                ✓ Correo: {formData.email || 'No ingresado'}
              </Text>
              <Text style={styles.previewText}>
                ✓ Idioma: Español
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.previewText}>
                ✓ Name: {formData.fullName || 'Not entered'}
              </Text>
              <Text style={styles.previewText}>
                ✓ Phone: {formData.phone || 'Not entered'}
              </Text>
              <Text style={styles.previewText}>
                ✓ Email: {formData.email || 'Not entered'}
              </Text>
              <Text style={styles.previewText}>
                ✓ Language: English
              </Text>
            </>
          )}
        </View>
      </View>

      <TouchableOpacity style={styles.submitButton}>
        <Text style={styles.submitButtonText}>
          {formData.language === 'ES'
            ? 'Guardar Preferencias'
            : 'Save Preferences'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 10,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#000',
  },
  field: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  description: {
    fontSize: 13,
    color: '#666',
    marginBottom: 12,
  },
  languageButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  languageButton: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: '#ddd',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9f9f9',
    gap: 8,
  },
  flag: {
    borderRadius: 2,
  },
  languageButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  languageButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  languageButtonTextActive: {
    color: '#fff',
  },
  previewBox: {
    backgroundColor: '#F0F8FF',
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 20,
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 10,
  },
  previewContent: {
    gap: 6,
  },
  previewText: {
    fontSize: 12,
    color: '#333',
  },
  submitButton: {
    backgroundColor: '#34C759',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
