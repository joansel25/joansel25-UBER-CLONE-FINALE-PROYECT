import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTranslation } from '../../hooks/useTranslation';

export default function ContactTab({ formData = { email: '', phone: '' }, rating }) {
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('contact_title')}</Text>

      {/* Email — immutable after registration */}
      <View style={styles.field}>
        <Text style={styles.label}>{t('contact_email_label')}</Text>
        <View style={styles.readonlyBox}>
          <Icon name="mail-outline" size={18} color="#666" style={styles.fieldIcon} />
          <Text style={styles.readonlyText}>{formData.email || '—'}</Text>
          <View style={styles.lockBadge}>
            <Icon name="lock-closed" size={12} color="#888" />
          </View>
        </View>
        <Text style={styles.hint}>{t('contact_email_hint')}</Text>
      </View>

      {/* Phone — display only (editable via Personal tab) */}
      <View style={styles.field}>
        <Text style={styles.label}>{t('contact_phone_label')}</Text>
        <View style={styles.readonlyBox}>
          <Icon name="call-outline" size={18} color="#666" style={styles.fieldIcon} />
          <Text style={styles.readonlyText}>{formData.phone || '—'}</Text>
        </View>
        <Text style={styles.hint}>{t('contact_phone_hint')}</Text>
      </View>

      {/* Rating */}
      {rating != null && (
        <View style={styles.field}>
          <Text style={styles.label}>{t('contact_rating_label')}</Text>
          <View style={styles.ratingBox}>
            {[1, 2, 3, 4, 5].map(star => (
              <Icon
                key={star}
                name="star"
                size={28}
                color={star <= Math.round(rating) ? '#FF9500' : '#ddd'}
              />
            ))}
            <Text style={styles.ratingNum}>{Number(rating).toFixed(1)}</Text>
          </View>
          <Text style={styles.hint}>{t('contact_rating_hint')}</Text>
        </View>
      )}

      {/* Info box */}
      <View style={styles.infoBox}>
        <Text style={styles.infoTitle}>{t('contact_security')}</Text>
        <Text style={styles.infoText}>
          <Icon name="checkmark-circle" size={13} color="#007AFF" />{t('contact_sec_firebase')}
        </Text>
        <Text style={styles.infoText}>
          <Icon name="checkmark-circle" size={13} color="#007AFF" />{t('contact_sec_password')}
        </Text>
        <Text style={styles.infoText}>
          <Icon name="checkmark-circle" size={13} color="#007AFF" />{t('contact_sec_token')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20, paddingTop: 10, backgroundColor: '#fff' },
  title:     { fontSize: 18, fontWeight: 'bold', marginBottom: 20, color: '#000' },
  field:     { marginBottom: 20 },
  label:     { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  hint:      { fontSize: 12, color: '#999', marginTop: 6, fontStyle: 'italic' },

  readonlyBox: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#f9f9f9',
  },
  fieldIcon:    { marginRight: 10 },
  readonlyText: { flex: 1, fontSize: 14, color: '#555' },
  lockBadge: {
    backgroundColor: '#eee', borderRadius: 12,
    padding: 4, alignItems: 'center', justifyContent: 'center',
  },

  ratingBox: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 8,
  },
  ratingNum: { fontSize: 22, fontWeight: '800', color: '#1a1a1a', marginLeft: 8 },

  infoBox: {
    backgroundColor: '#E3F2FD', borderLeftWidth: 4,
    borderLeftColor: '#007AFF', padding: 14,
    borderRadius: 8, marginTop: 8, gap: 6,
  },
  infoTitle: { fontSize: 13, fontWeight: '700', color: '#007AFF', marginBottom: 6 },
  infoText:  { fontSize: 12, color: '#333' },
});
