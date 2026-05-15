import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  FlatList,
  ActivityIndicator,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';
import firestore from '@react-native-firebase/firestore';
import storage from '@react-native-firebase/storage';

// Gender options for the dropdown
const GENDER_OPTIONS = [
  { label: 'Male', value: 'Male' },
  { label: 'Female', value: 'Female' },
  { label: 'Other', value: 'Other' },
];

export default function PersonalInfoTab({ formData = { fullName: '', phone: '', gender: '', description: '', photo: null }, updateFormData = () => { } }) {
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // Validation for full name
  const validateFullName = (name) => {
    if (!name || name.trim() === '') {
      Alert.alert('Error', 'Full name cannot be empty');
      return false;
    }
    if (name.length > 50) {
      Alert.alert('Error', 'Name cannot exceed 50 characters');
      return false;
    }
    return true;
  };

  // Validation for phone number
  const validatePhone = (phone) => {
    if (!phone || phone.trim() === '') {
      Alert.alert('Error', 'Phone number cannot be empty');
      return false;
    }
    if (!/^\d+$/.test(phone)) {
      Alert.alert('Error', 'Phone must contain only numbers');
      return false;
    }
    return true;
  };

  // Handle name change with max length check
  const handleNameChange = (text) => {
    if (text.length <= 50) {
      updateFormData('fullName', text);
    }
  };

  // Handle phone change to allow only numeric input
  const handlePhoneChange = (text) => {
    const numericText = text.replace(/[^0-9]/g, '');
    updateFormData('phone', numericText);
  };

  // Select gender and close modal
  const selectGender = (value) => {
    updateFormData('gender', value);
    setShowGenderModal(false);
  };

  // Get label for current gender value
  const getGenderLabel = (value) => {
    const option = GENDER_OPTIONS.find(opt => opt.value === value);
    return option ? option.label : 'Select gender';
  };

  // Handle photo selection
  const handleSelectPhoto = async () => {
    try {
      const result = await launchImageLibrary({
        mediaType: 'photo',
        quality: 0.8,
        includeBase64: false,
      });

      if (result.didCancel) return;
      if (result.errorCode) {
        Alert.alert('Error', result.errorMessage || 'Failed to select photo');
        return;
      }

      if (result.assets && result.assets.length > 0) {
        updateFormData('photo', result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred while selecting the photo');
    }
  };

  // Handle form submission to Firebase
  const handleSave = async () => {
    if (!validateFullName(formData.fullName) || !validatePhone(formData.phone)) return;
    if (!formData.gender) {
      Alert.alert('Error', 'Please select a gender');
      return;
    }

    setLoading(true);
    try {
      let finalPhotoUrl = formData.photo;

      // Upload photo to Firebase Storage if it's a local file
      if (formData.photo && (formData.photo.startsWith('file://') || formData.photo.startsWith('content://'))) {
        const filename = `profiles/${Date.now()}_${formData.fullName.replace(/\s/g, '_')}.jpg`;
        const reference = storage().ref(filename);
        await reference.putFile(formData.photo);
        finalPhotoUrl = await reference.getDownloadURL();
      }

      // Save to Firestore
      await firestore().collection('users').add({
        fullName: formData.fullName,
        phone: formData.phone,
        gender: formData.gender,
        description: formData.description || '',
        photo: finalPhotoUrl,
        createdAt: firestore.FieldValue.serverTimestamp(),
      });

      Alert.alert('Success', 'Personal information saved to Firebase!');
    } catch (error) {
      console.error('Error saving to Firebase:', error);
      Alert.alert('Error', 'Failed to save information: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Personal Information</Text>

      {/* Full Name Field */}
      <View style={styles.field}>
        <Text style={styles.label}>Full Name *</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your full name"
          value={formData.fullName}
          onChangeText={handleNameChange}
          maxLength={50}
          placeholderTextColor="#999"
        />
        <Text style={styles.counter}>
          {formData.fullName.length}/50 characters
        </Text>
      </View>

      {/* Phone Number Field */}
      <View style={styles.field}>
        <Text style={styles.label}>Phone Number *</Text>
        <TextInput
          style={styles.input}
          placeholder="Enter your phone"
          value={formData.phone}
          onChangeText={handlePhoneChange}
          keyboardType="numeric"
          placeholderTextColor="#999"
        />
      </View>

      {/* Gender Field (Custom Dropdown) */}
      <View style={styles.field}>
        <Text style={styles.label}>Gender *</Text>
        <TouchableOpacity
          style={styles.dropdownButton}
          onPress={() => setShowGenderModal(true)}
        >
          <Text style={[
            styles.dropdownButtonText,
            !formData.gender && { color: '#999' }
          ]}>
            {getGenderLabel(formData.gender)}
          </Text>
          <Icon name="chevron-down" size={14} color="#666" />
        </TouchableOpacity>
      </View>

      {/* Gender Selection Modal */}
      <Modal
        visible={showGenderModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowGenderModal(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowGenderModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Gender</Text>
            <FlatList
              data={GENDER_OPTIONS}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.optionButton}
                  onPress={() => selectGender(item.value)}
                >
                  <Text style={[
                    styles.optionText,
                    formData.gender === item.value && styles.optionTextActive
                  ]}>
                    {item.label}
                  </Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Description Field */}
      <View style={styles.field}>
        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Tell us about yourself (optional)"
          value={formData.description}
          onChangeText={(text) =>
            updateFormData('description', text)
          }
          multiline
          numberOfLines={4}
          placeholderTextColor="#999"
        />
      </View>

      {/* Profile Photo Section */}
      <View style={styles.field}>
        <Text style={styles.label}>Profile Photo</Text>
        <TouchableOpacity 
          style={styles.uploadButton}
          onPress={handleSelectPhoto}
          disabled={loading}
        >
          <Icon name="camera" size={20} color="#fff" style={{ marginRight: 8 }} />
          <Text style={styles.uploadButtonText}>Select Photo</Text>
        </TouchableOpacity>
        {formData.photo && (
          <View style={styles.photoPreviewContainer}>
            <Image source={{ uri: formData.photo }} style={styles.photoPreview} />
            <Text style={styles.photoSelected}>Photo selected ✓</Text>
          </View>
        )}
      </View>

      <TouchableOpacity 
        style={[styles.submitButton, loading && styles.submitButtonDisabled]}
        onPress={handleSave}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.submitButtonText}>Save Personal Info</Text>
        )}
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
  textArea: {
    textAlignVertical: 'top',
    minHeight: 100,
  },
  counter: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  dropdownButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#f9f9f9',
  },
  dropdownButtonText: {
    fontSize: 14,
    color: '#000',
  },
  dropdownIcon: {
    fontSize: 12,
    color: '#666',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    maxHeight: '50%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    textAlign: 'center',
    color: '#333',
  },
  optionButton: {
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
    textAlign: 'center',
  },
  optionTextActive: {
    color: '#007AFF',
    fontWeight: 'bold',
  },
  uploadButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  photoSelected: {
    color: '#4CAF50',
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
  },
  photoPreviewContainer: {
    marginTop: 10,
    alignItems: 'center',
    flexDirection: 'row',
  },
  photoPreview: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 10,
  },
  submitButton: {
    backgroundColor: '#34C759',
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  submitButtonDisabled: {
    backgroundColor: '#A5D6A7',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
