import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, Modal, FlatList, ActivityIndicator, Image,
} from 'react-native';
import Icon              from 'react-native-vector-icons/Ionicons';
import { launchImageLibrary } from 'react-native-image-picker';
import storage           from '@react-native-firebase/storage';
import { useTranslation } from '../../hooks/useTranslation';
import { useTheme }       from '../../context/ThemeContext';
import { useAuth }        from '../../context/AuthContext';
import userApi            from '../../api/userApi';

const GENDER_KEYS = ['male', 'female', 'other'];

export default function PersonalInfoTab({
  formData      = { fullName: '', phone: '', gender: '', photo: null },
  updateFormData = () => {},
  onSave         = () => {},
  isSaving       = false,
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { updateDbUser } = useAuth();
  const styles = makeStyles(colors);

  const [showGenderModal, setShowGenderModal] = useState(false);
  const [uploadingPhoto,  setUploadingPhoto]  = useState(false);

  const genderOptions = GENDER_KEYS.map(v => ({ value: v, label: t('register_gender_' + v) }));

  const handleSelectPhoto = async () => {
    const prevPhoto = formData.photo;
    try {
      const result = await launchImageLibrary({
        mediaType:     'photo',
        quality:       0.7,
        includeBase64: true,
      });
      if (result.didCancel) return;

      const asset = result.assets?.[0];
      if (!asset?.uri || !asset?.base64) return;

      updateFormData('photo', asset.uri);
      setUploadingPhoto(true);

      const ref = storage().ref(`profiles/${Date.now()}.jpg`);
      await ref.putString(asset.base64, 'base64');
      const downloadUrl = await ref.getDownloadURL();

      await userApi.updateProfile({ profilePic: downloadUrl });
      updateDbUser({ profilePic: downloadUrl });
      updateFormData('photo', downloadUrl);
    } catch {
      updateFormData('photo', prevPhoto);
      Alert.alert('Error', t('personal_photo_error'));
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSave = () => {
    if (!formData.fullName?.trim() || formData.fullName.trim().length < 3) {
      Alert.alert('Error', t('personal_name_error'));
      return;
    }
    if (!/^\d{7,}$/.test(formData.phone)) {
      Alert.alert('Error', t('personal_phone_error'));
      return;
    }
    onSave({ fullName: formData.fullName.trim(), phone: formData.phone.trim() });
  };

  const genderLabel = formData.gender
    ? t('register_gender_' + formData.gender)
    : '—';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('personal_title')}</Text>

      {/* Profile photo */}
      <View style={styles.photoSection}>
        <View style={styles.avatar}>
          {formData.photo
            ? <Image source={{ uri: formData.photo }} style={styles.avatarImage} />
            : <Icon name="person-circle-outline" size={64} color={colors.textSecondary} />
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
          <Icon name="camera-outline" size={16} color={colors.primary} />
          <Text style={styles.changePhotoText}>
            {uploadingPhoto ? t('personal_uploading') : t('personal_change_photo')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Full name */}
      <View style={styles.field}>
        <Text style={styles.label}>{t('personal_name_label')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('personal_name_ph')}
          placeholderTextColor={colors.textSecondary}
          value={formData.fullName}
          onChangeText={v => updateFormData('fullName', v.length <= 50 ? v : formData.fullName)}
          maxLength={50}
        />
        <Text style={styles.counter}>{t('personal_name_counter', (formData.fullName || '').length)}</Text>
      </View>

      {/* Phone */}
      <View style={styles.field}>
        <Text style={styles.label}>{t('personal_phone_label')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('personal_phone_ph')}
          placeholderTextColor={colors.textSecondary}
          value={formData.phone}
          onChangeText={v => updateFormData('phone', v.replace(/[^0-9]/g, ''))}
          keyboardType="numeric"
        />
      </View>

      {/* Gender — readonly */}
      <View style={styles.field}>
        <Text style={styles.label}>{t('personal_gender_label')}</Text>
        <View style={[styles.input, styles.readonlyRow]}>
          <Text style={styles.readonlyText}>{genderLabel}</Text>
          <View style={styles.readonlyBadge}>
            <Text style={styles.readonlyBadgeText}>{t('personal_not_editable')}</Text>
          </View>
        </View>
        <Text style={styles.hint}>{t('personal_gender_hint')}</Text>
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
          : <Text style={styles.saveButtonText}>{t('personal_save')}</Text>
        }
      </TouchableOpacity>

      {/* Gender modal */}
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
            <Text style={styles.modalTitle}>{t('personal_gender_label')}</Text>
            <FlatList
              data={genderOptions}
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
                    <Icon name="checkmark" size={18} color={colors.primary} />
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

function makeStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 20, paddingTop: 10, backgroundColor: colors.surface },
    title:     { fontSize: 18, fontWeight: 'bold', marginBottom: 20, color: colors.textPrimary },

    photoSection: { alignItems: 'center', marginBottom: 24 },
    avatar: {
      width: 88, height: 88, borderRadius: 44,
      backgroundColor: colors.inputBg, alignItems: 'center', justifyContent: 'center',
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
      borderWidth: 1.5, borderColor: colors.primary, borderRadius: 20,
    },
    changePhotoText: { color: colors.primary, fontSize: 13, fontWeight: '600' },

    field:   { marginBottom: 18 },
    label:   { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 },
    counter: { fontSize: 12, color: colors.textSecondary, marginTop: 4 },
    hint:    { fontSize: 12, color: colors.textSecondary, marginTop: 4, fontStyle: 'italic' },
    input: {
      borderWidth: 1, borderColor: colors.border, borderRadius: 8,
      paddingHorizontal: 12, paddingVertical: 10,
      fontSize: 14, color: colors.textPrimary, backgroundColor: colors.inputBg,
    },
    readonlyRow:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    readonlyText:      { fontSize: 14, color: colors.textSecondary },
    readonlyBadge:     { backgroundColor: colors.lightGray, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
    readonlyBadgeText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },

    saveButton: {
      backgroundColor: colors.success, paddingVertical: 14,
      borderRadius: 8, alignItems: 'center', marginTop: 10, marginBottom: 30,
    },
    saveButtonDisabled: { opacity: 0.55 },
    saveButtonText:     { color: '#fff', fontSize: 16, fontWeight: '700' },

    modalOverlay: {
      flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center', alignItems: 'center', padding: 20,
    },
    modalContent: {
      width: '100%', backgroundColor: colors.surface,
      borderRadius: 15, padding: 20, maxHeight: '50%',
    },
    modalTitle:       { fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center', color: colors.textPrimary },
    optionRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.border },
    optionText:       { fontSize: 16, color: colors.textPrimary },
    optionTextActive: { color: colors.primary, fontWeight: 'bold' },
  });
}
