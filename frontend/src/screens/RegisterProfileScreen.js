import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity, Alert, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';

import PersonalInfoTab from './tabs/PersonalInfoTab';
import ContactTab      from './tabs/ContactTab';
import PreferencesTab  from './tabs/PreferencesTab';
import { useAuth }     from '../context/AuthContext';
import { useTranslation } from '../hooks/useTranslation';
import userApi         from '../api/userApi';

const TABS = [
  { id: 'personal',    labelKey: 'profile_tab_personal', icon: 'person' },
  { id: 'contact',     labelKey: 'profile_tab_contact',  icon: 'mail' },
  { id: 'preferences', labelKey: 'profile_tab_prefs',    icon: 'settings' },
];

export default function RegisterProfileScreen({ navigation }) {
  const { dbUser, signOut, refreshUser, updateDbUser } = useAuth();
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState('personal');
  const [isSaving,  setIsSaving]  = useState(false);

  // Local copy of editable fields — seeded from backend profile
  const [formData, setFormData] = useState({
    fullName: '',
    phone:    '',
    gender:   '',
    email:    '',
    language: 'ES',
    photo:    null,
  });

  // Pre-fill form when dbUser loads or refreshes
  useEffect(() => {
    if (dbUser) {
      setFormData({
        fullName: dbUser.fullName  || '',
        phone:    dbUser.phone     || '',
        gender:   dbUser.gender    || '',
        email:    dbUser.email     || '',
        language: dbUser.language  || 'ES',
        photo:    dbUser.profilePic || null,
      });
    }
  }, [dbUser]);

  const updateFormData = (key, value) =>
    setFormData(prev => ({ ...prev, [key]: value }));

  // Called by each tab's save button with only the fields it owns
  const handleSave = async (updates) => {
    setIsSaving(true);
    try {
      await userApi.updateProfile(updates);
      updateDbUser(updates); // instant local state update — language/name changes take effect immediately
      refreshUser().catch(() => {}); // background sync with Firestore (no await — don't block UI)
      Alert.alert('', t('profile_saved_ok'));
    } catch (error) {
      Alert.alert('Error', t('profile_save_error', error.message));
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = () =>
    Alert.alert(t('profile_logout_title'), t('profile_logout_msg'), [
      { text: t('profile_logout_cancel'), style: 'cancel' },
      { text: t('profile_logout_btn'), style: 'destructive', onPress: () => { signOut().catch(() => {}); } },
    ]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>{t('profile_title')}</Text>
            {dbUser?.rating != null && (
              <View style={styles.ratingRow}>
                <Icon name="star" size={14} color="#FF9500" />
                <Text style={styles.ratingText}>{Number(dbUser.rating).toFixed(1)}</Text>
                <Text style={styles.ratingRole}>
                  · {dbUser.role === 'driver' ? t('profile_role_driver') : t('profile_role_passenger')}
                </Text>
              </View>
            )}
          </View>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
            <Icon name="log-out-outline" size={22} color="#FF3B30" />
          </TouchableOpacity>
        </View>
        <Text style={styles.headerSubtitle}>{t('profile_required')}</Text>

        {/* Quick-action rows — passengers only */}
        {dbUser?.role !== 'driver' && (
          <>
            <TouchableOpacity
              style={styles.walletRow}
              onPress={() => navigation.navigate('PaymentMethods')}
            >
              <Icon name="card-outline" size={18} color="#007AFF" />
              <Text style={styles.walletText}>{t('profile_payment')}</Text>
              <Icon name="chevron-forward" size={16} color="#666" style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.walletRow, { marginTop: 8 }]}
              onPress={() => navigation.navigate('PaymentHistory')}
            >
              <Icon name="receipt-outline" size={18} color="#007AFF" />
              <Text style={styles.walletText}>{t('profile_pay_history')}</Text>
              <Icon name="chevron-forward" size={16} color="#666" style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.walletRow, { backgroundColor: '#F0FFF4', marginTop: 8 }]}
              onPress={() => navigation.navigate('DriverRegister')}
            >
              <Icon name="car-sport-outline" size={18} color="#34C759" />
              <Text style={[styles.walletText, { color: '#34C759' }]}>{t('profile_become_driver')}</Text>
              <Icon name="chevron-forward" size={16} color="#666" style={{ marginLeft: 'auto' }} />
            </TouchableOpacity>
          </>
        )}
        {isSaving && (
          <View style={styles.savingRow}>
            <ActivityIndicator size="small" color="#007AFF" />
            <Text style={styles.savingText}>{t('profile_saving')}</Text>
          </View>
        )}
      </View>

      {/* ── Tab bar ── */}
      <View style={styles.tabWrapper}>
        <View style={styles.tabContainer}>
          {TABS.map(tab => (
            <TouchableOpacity
              key={tab.id}
              style={[styles.tabButton, activeTab === tab.id && styles.tabButtonActive]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Icon
                name={tab.icon}
                size={20}
                color={activeTab === tab.id ? '#007AFF' : '#666'}
              />
              <Text style={[styles.tabLabel, activeTab === tab.id && styles.tabLabelActive]}>
                {t(tab.labelKey)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* ── Tab content ── */}
      <ScrollView style={styles.tabContent} keyboardShouldPersistTaps="handled">
        {activeTab === 'personal' && (
          <PersonalInfoTab
            formData={formData}
            updateFormData={updateFormData}
            onSave={handleSave}
            isSaving={isSaving}
          />
        )}
        {activeTab === 'contact' && (
          <ContactTab
            formData={formData}
            rating={dbUser?.rating}
          />
        )}
        {activeTab === 'preferences' && (
          <PreferencesTab
            formData={formData}
            updateFormData={updateFormData}
            onSave={handleSave}
            isSaving={isSaving}
          />
        )}
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#fff' },
  header:      { paddingHorizontal: 25, paddingTop: 10, paddingBottom: 16 },
  headerTop:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerTitle: { fontSize: 28, fontWeight: '800', color: '#1a1a1a', letterSpacing: -0.5 },
  ratingRow:   { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4 },
  ratingText:  { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  ratingRole:  { fontSize: 13, color: '#666' },
  logoutBtn:   { padding: 4 },
  headerSubtitle: { fontSize: 14, color: '#666', marginTop: 6 },
  savingRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  savingText:  { fontSize: 13, color: '#007AFF' },
  walletRow:   {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginTop: 10, paddingVertical: 10, paddingHorizontal: 12,
    backgroundColor: '#F0F6FF', borderRadius: 10,
  },
  walletText:  { fontSize: 14, fontWeight: '600', color: '#007AFF' },
  tabWrapper:  { paddingHorizontal: 20, marginBottom: 10 },
  tabContainer: {
    flexDirection: 'row', backgroundColor: '#f0f0f0', borderRadius: 12, padding: 4,
  },
  tabButton:       { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabButtonActive: {
    backgroundColor: '#fff', elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4,
  },
  tabLabel:       { fontSize: 11, fontWeight: '600', color: '#666', marginTop: 2 },
  tabLabelActive: { color: '#007AFF' },
  tabContent:     { flex: 1 },
});
