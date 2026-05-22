import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

import PersonalInfoTab from './tabs/PersonalInfoTab';
import ContactTab from './tabs/ContactTab';
import PreferencesTab from './tabs/PreferencesTab';
import { useAuth } from '../context/AuthContext';

export default function RegisterProfileScreen() {
  const { signOut } = useAuth();

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Deseas cerrar tu sesión?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Salir', style: 'destructive', onPress: signOut },
    ]);
  };
  // Local state to manage active tab and form data
  const [activeTab, setActiveTab] = useState('personal');
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

  const tabs = [
    { id: 'personal', label: 'Personal Info' },
    { id: 'contact', label: 'Contact' },
    { id: 'preferences', label: 'Preferences' },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>

      <View style={styles.header}>
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>My Profile</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Icon name="log-out-outline" size={22} color="#FF3B30" />
          </TouchableOpacity>
        </View>
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logoutBtn: {
    padding: 4,
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
});