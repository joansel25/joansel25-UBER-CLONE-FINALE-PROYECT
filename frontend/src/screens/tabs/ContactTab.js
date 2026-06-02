import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTranslation } from '../../hooks/useTranslation';
import { useTheme }       from '../../context/ThemeContext';

export default function ContactTab({ formData = { email: '', phone: '' }, rating }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const styles = makeStyles(colors);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('contact_title')}</Text>

      {/* Email — immutable after registration */}
      <View style={styles.field}>
        <Text style={styles.label}>{t('contact_email_label')}</Text>
        <View style={styles.readonlyBox}>
          <Icon name="mail-outline" size={18} color={colors.textSecondary} style={styles.fieldIcon} />
          <Text style={styles.readonlyText}>{formData.email || '—'}</Text>
          <View style={styles.lockBadge}>
            <Icon name="lock-closed" size={12} color={colors.textSecondary} />
          </View>
        </View>
        <Text style={styles.hint}>{t('contact_email_hint')}</Text>
      </View>

      {/* Phone — display only */}
      <View style={styles.field}>
        <Text style={styles.label}>{t('contact_phone_label')}</Text>
        <View style={styles.readonlyBox}>
          <Icon name="call-outline" size={18} color={colors.textSecondary} style={styles.fieldIcon} />
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
                color={star <= Math.round(rating) ? colors.warning : colors.border}
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
          <Icon name="checkmark-circle" size={13} color={colors.primary} />{t('contact_sec_firebase')}
        </Text>
        <Text style={styles.infoText}>
          <Icon name="checkmark-circle" size={13} color={colors.primary} />{t('contact_sec_password')}
        </Text>
        <Text style={styles.infoText}>
          <Icon name="checkmark-circle" size={13} color={colors.primary} />{t('contact_sec_token')}
        </Text>
      </View>
    </View>
  );
}

function makeStyles(colors) {
  return StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 20, paddingTop: 10, backgroundColor: colors.surface },
    title:     { fontSize: 18, fontWeight: 'bold', marginBottom: 20, color: colors.textPrimary },
    field:     { marginBottom: 20 },
    label:     { fontSize: 14, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 },
    hint:      { fontSize: 12, color: colors.textSecondary, marginTop: 6, fontStyle: 'italic' },

    readonlyBox: {
      flexDirection: 'row', alignItems: 'center',
      borderWidth: 1, borderColor: colors.border, borderRadius: 8,
      paddingHorizontal: 12, paddingVertical: 12, backgroundColor: colors.inputBg,
    },
    fieldIcon:    { marginRight: 10 },
    readonlyText: { flex: 1, fontSize: 14, color: colors.textSecondary },
    lockBadge: {
      backgroundColor: colors.lightGray, borderRadius: 12,
      padding: 4, alignItems: 'center', justifyContent: 'center',
    },

    ratingBox: {
      flexDirection: 'row', alignItems: 'center', gap: 4,
      paddingVertical: 8,
    },
    ratingNum: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginLeft: 8 },

    infoBox: {
      backgroundColor: colors.infoBox, borderLeftWidth: 4,
      borderLeftColor: colors.primary, padding: 14,
      borderRadius: 8, marginTop: 8, gap: 6,
    },
    infoTitle: { fontSize: 13, fontWeight: '700', color: colors.primary, marginBottom: 6 },
    infoText:  { fontSize: 12, color: colors.textPrimary },
  });
}
