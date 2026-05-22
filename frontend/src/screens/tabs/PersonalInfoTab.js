import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, Modal, FlatList, ActivityIndicator, Image,
} from 'react-native';
import Icon              from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';
import storage           from '@react-native-firebase/storage';

const GENDER_OPTIONS = [
  { label: 'Masculino', value: 'male' },
  { label: 'Femenino',  value: 'female' },
  { label: 'Otro',      value: 'other' },
];

export default function PersonalInfoTab({
  formData      = { fullName: '', phone: '', gender: '', photo: null },
  updateFormData = () => {},
  onSave         = () => {},
  isSaving       = false,
}) {
  const [showGenderModal, setShowGenderModal] = useState(false);
  const [uploadingPhoto,  setUploadingPhoto]  = useState(false);

  // ── Photo selection + Firebase Storage upload ─────────────────────────────
  const handleSelectPhoto = async () => {
    try {
      const result = await launchImageLibrary({ mediaType: 'photo', quality: 0.8 });
      if (result.didCancel || result.errorCode) return;

      const asset = result.assets?.[0];
      if (!asset) return;

      // Show local preview immediately while uploading
      updateFormData('photo', asset.uri);
      setUploadingPhoto(true);

      const filename = `profiles/${Date.now()}.jpg`;
      const ref      = storage().ref(filename);
      await ref.putFile(asset.uri);
      const downloadUrl = await ref.getDownloadURL();

      // Persist the remote URL to backend right away
      onSave({ profilePic: downloadUrl });
      updateFormData('photo', downloadUrl);
    } catch (error) {
      Alert.alert('Error', 'No se pudo subir la foto. Intenta de nuevo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // ── Save fullName + phone ─────────────────────────────────────────────────
  const handleSave = () => {
    if (!formData.fullName?.trim() || formData.fullName.trim().length < 3) {
      Alert.alert('Error', 'El nombre debe tener al menos 3 caracteres.');
      return;
    }
    if (!/^\d{7,}$/.test(formData.phone)) {
      Alert.alert('Error', 'El teléfono debe tener al menos 7 dígitos.');
      return;
    }
    onSave({ fullName: formData.fullName.trim(), phone: formData.phone.trim() });
  };

  const genderLabel =
    GENDER_OPTIONS.find(o => o.value === formData.gender)?.label || '—';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Información Personal</Text>

      {/* Profile photo */}
      <View style={styles.photoSection}>
        <View style={styles.avatar}>
          {formData.photo
            ? <Image source={{ uri: formData.photo }} style={styles.avatarImage} />
            : <Icon name="person-circle-outline" size={64} color="#bbb" />
          }
          {uploadingPhoto && (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator color="#fff" />
            </View>
          )}
        </View>
        <TouchableOpacity
          style={styles.changePhotoBtn}
          onPress={handleSelectPhoto}
          disabled={uploadingPhoto || isSaving}
        >
          <Icon name="camera-outline" size={16} color="#007AFF" />
          <Text style={styles.changePhotoText}>
            {uploadingPhoto ? 'Subiendo…' : 'Cambiar foto'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Full name */}
      <View style={styles.field}>
        <Text style={styles.label}>Nombre completo *</Text>
        <TextInput
          style={styles.input}
          placeholder="Tu nombre completo"
          value={formData.fullName}
          onChangeText={v => updateFormData('fullName', v.length <= 50 ? v : formData.fullName)}
          maxLength={50}
          placeholderTextColor="#999"
        />
        <Text style={styles.counter}>{(formData.fullName || '').length}/50 caracteres</Text>
      </View>

      {/* Phone */}
      <View style={styles.field}>
        <Text style={styles.label}>Teléfono *</Text>
        <TextInput
          style={styles.input}
          placeholder="3001234567"
          value={formData.phone}
          onChangeText={v => updateFormData('phone', v.replace(/[^0-9]/g, ''))}
          keyboardType="numeric"
          placeholderTextColor="#999"
        />
      </View>

      {/* Gender — readonly, set at registration */}
      <View style={styles.field}>
        <Text style={styles.label}>Género</Text>
        <View style={[styles.input, styles.readonlyRow]}>
          <Text style={styles.readonlyText}>{genderLabel}</Text>
          <View style={styles.readonlyBadge}>
            <Text style={styles.readonlyBadgeText}>No editable</Text>
          </View>
        </View>
        <Text style={styles.hint}>El género se define al crear la cuenta.</Text>
      </View>

      {/* Save button */}
      <TouchableOpacity
        style={[styles.saveButton, (isSaving || uploadingPhoto) && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={isSaving || uploadingPhoto}
        activeOpacity={0.8}
      >
        {isSaving
          ? <ActivityIndicator color="#fff" />
          : <Text style={styles.saveButtonText}>Guardar cambios</Text>
        }
      </TouchableOpacity>

      {/* Gender modal (kept for reference — gender is readonly after register) */}
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
            <Text style={styles.modalTitle}>Género</Text>
            <FlatList
              data={GENDER_OPTIONS}
              keyExtractor={item => item.value}
              renderItem={({ item }) => (
                <View style={styles.optionRow}>
                  <Text style={[
                    styles.optionText,
                    formData.gender === item.value && styles.optionTextActive,
                  ]}>
                    {item.label}
                  </Text>
                  {formData.gender === item.value &&
                    <Icon name="checkmark" size={18} color="#007AFF" />
                  }
                </View>
              )}
            />
          </View>
        </TouchableOpacity>
      </Modal>

    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 10, backgroundColor: '#fff' },
  title:     { fontSize: 18, fontWeight: 'bold', marginBottom: 20, color: '#000' },

  photoSection: { alignItems: 'center', marginBottom: 24 },
  avatar: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: '#f0f0f0', alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage:   { width: 88, height: 88, borderRadius: 44 },
  avatarOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  changePhotoBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10, paddingVertical: 6, paddingHorizontal: 14,
    borderWidth: 1.5, borderColor: '#007AFF', borderRadius: 20,
  },
  changePhotoText: { color: '#007AFF', fontSize: 13, fontWeight: '600' },

  field:    { marginBottom: 18 },
  label:    { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  counter:  { fontSize: 12, color: '#999', marginTop: 4 },
  hint:     { fontSize: 12, color: '#999', marginTop: 4, fontStyle: 'italic' },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: '#000', backgroundColor: '#f9f9f9',
  },
  readonlyRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  readonlyText:  { fontSize: 14, color: '#555' },
  readonlyBadge: {
    backgroundColor: '#f0f0f0', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  readonlyBadgeText: { fontSize: 11, color: '#888', fontWeight: '600' },

  saveButton: {
    backgroundColor: '#34C759', paddingVertical: 14,
    borderRadius: 8, alignItems: 'center', marginTop: 10, marginBottom: 30,
  },
  saveButtonDisabled: { backgroundColor: '#A5D6A7' },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 20,
  },
  modalContent: {
    width: '100%', backgroundColor: '#fff',
    borderRadius: 15, padding: 20, maxHeight: '50%',
  },
  modalTitle:      { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: '#333' },
  optionRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
  optionText:      { fontSize: 16, color: '#333' },
  optionTextActive: { color: '#007AFF', fontWeight: 'bold' },
});
