import React from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';

export default function ContactTab({ formData = { email: '' }, updateFormData = () => {} }) {
  // Validate email format including @ and domain
  const validateEmail = (email) => {
    if (!email || email.trim() === '') {
      Alert.alert('Error', 'Email cannot be empty');
      return false;
    }

    if (!email.includes('@')) {
      Alert.alert('Error', 'Email must contain @');
      return false;
    }

    const emailParts = email.split('@');
    if (emailParts.length !== 2) {
      Alert.alert('Error', 'Invalid email format');
      return false;
    }

    const domain = emailParts[1];
    if (!domain.includes('.')) {
      Alert.alert('Error', 'Domain must contain a dot (.)');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert('Error', 'Invalid email format');
      return false;
    }

    return true;
  };

  const handleEmailChange = (text) => {
    updateFormData('email', text);
  };

  const handleValidation = () => {
    if (validateEmail(formData.email)) {
      Alert.alert('Success', 'Valid email format ✓');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Contact Information</Text>

      {/* Email Field */}
      <View style={styles.field}>
        <Text style={styles.label}>Email Address *</Text>
        <TextInput
          style={styles.input}
          placeholder="example@domain.com"
          value={formData.email}
          onChangeText={handleEmailChange}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholderTextColor="#999"
        />
        <Text style={styles.hint}>
          Must include @ and a valid domain (e.g., .com, .es, .co)
        </Text>
      </View>

      {/* Validation Button */}
      <TouchableOpacity
        style={styles.validateButton}
        onPress={handleValidation}
      >
        <Text style={styles.validateButtonText}>Validate Email</Text>
      </TouchableOpacity>

      {/* Info Box */}
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>Email Validation Rules</Text>
        <Text style={styles.infoText}>✓ Must contain @</Text>
        <Text style={styles.infoText}>✓ Must contain a valid domain</Text>
        <Text style={styles.infoText}>✓ Cannot be empty</Text>
      </View>

      <TouchableOpacity style={styles.submitButton}>
        <Text style={styles.submitButtonText}>Save Contact Info</Text>
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
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#000',
    backgroundColor: '#f9f9f9',
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
    fontStyle: 'italic',
  },
  validateButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 20,
  },
  validateButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#E3F2FD',
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
    padding: 12,
    borderRadius: 6,
    marginBottom: 20,
  },
  infoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#007AFF',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#333',
    marginBottom: 4,
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
