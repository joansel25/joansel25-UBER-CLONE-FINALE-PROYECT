import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { saveUser } from '../storage/FirestoreServices';

import PersonalInfoTab from './tabs/PersonalInfoTab';
import ContactTab from './tabs/ContactTab';
import PreferencesTab from './tabs/PreferencesTab';

export default function RegisterProfileScreen() {
  const navigation = useNavigation();
  // Local state to manage active tab and form data
  const [activeTab, setActiveTab] = useState('personal');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    gender: '',
    description: '',
    photo: null,
    email: '',
    language: 'ES',
  });

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  const updateFormData = (key, value) => {
    setFormData(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSaveUser = async () => {
    // Validar campos obligatorios
    if (!formData.fullName || !formData.phone || !formData.email || !formData.gender) {
      Alert.alert('Error', 'Por favor completa todos los campos requeridos (*)');
      return;
    }

    setLoading(true);
    try {
      // Usar email como userId (puedes usar auth también)
      const result = await saveUser(formData.email, {
        fullName: formData.fullName,
        phone: formData.phone,
        email: formData.email,
        gender: formData.gender,
        language: formData.language,
        photo: formData.photo,
        createdAt: new Date().toISOString(),
      });

      if (result.success) {
        Alert.alert('Éxito', 'Perfil guardado correctamente');
        // Navegar a la siguiente pantalla
        navigation.navigate('Home');
      } else {
        Alert.alert('Error', result.message);
      }
    } catch (error) {
      Alert.alert('Error', 'Error al guardar el perfil: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'personal', label: 'Personal Info' },
    { id: 'contact', label: 'Contact' },
    { id: 'preferences', label: 'Preferences' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>

      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Profile</Text>
        <Text style={styles.headerSubtitle}>Complete your information to get started</Text>
        <Text style={styles.headerSubtitle}>All spaces with * are mandatory</Text>
      </View>


      <View style={styles.tabWrapper}>
        <View style={styles.tabContainer}>
          {tabs.map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={[
                styles.tabButton,
                activeTab === tab.id && styles.tabButtonActive,
              ]}
              onPress={() => handleTabChange(tab.id)}
            >
              <Icon
                name={tab.id === 'personal' ? 'person' : tab.id === 'contact' ? 'mail' : 'settings'}
                size={20}
                color={activeTab === tab.id ? '#007AFF' : '#666'}
              />
              <Text
                style={[
                  styles.tabLabel,
                  activeTab === tab.id && styles.tabLabelActive,
                ]}
              >
                {tab.label.split(' ')[0]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Tab Content Rendering */}
      <ScrollView style={styles.tabContent}>
        {activeTab === 'personal' && (
          <PersonalInfoTab
            formData={formData}
            updateFormData={updateFormData}
          />
        )}
        {activeTab === 'contact' && (
          <ContactTab
            formData={formData}
            updateFormData={updateFormData}
          />
        )}
        {activeTab === 'preferences' && (
          <PreferencesTab
            formData={formData}
            updateFormData={updateFormData}
          />
        )}
      </ScrollView>

      {/* Save Button */}
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.saveButton, loading && styles.saveButtonDisabled]}
          onPress={handleSaveUser}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Profile</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    paddingHorizontal: 25,
    paddingTop: 10,
    paddingBottom: 20,
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#1a1a1a',
    letterSpacing: -0.5,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#666',
    marginTop: 5,
  },
  tabWrapper: {
    paddingHorizontal: 20,
    marginBottom: 10,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 12,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabButtonActive: {
    backgroundColor: '#fff',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  tabLabelActive: {
    color: '#007AFF',
  },
  tabContent: {
    flex: 1,
  },
  buttonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
  saveButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});