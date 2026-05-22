import React from 'react';
import {
  TouchableOpacity, Text, ActivityIndicator, StyleSheet,
} from 'react-native';
import { COLORS, RADIUS, FONT } from '../../constants/theme';

export default function Button({
  label,
  onPress,
  loading   = false,
  disabled  = false,
  variant   = 'primary',  // 'primary' | 'success' | 'danger' | 'outline'
  style,
}) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[styles.base, styles[variant], isDisabled && styles.disabled, style]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
    >
      {loading
        ? <ActivityIndicator color={variant === 'outline' ? COLORS.primary : COLORS.white} />
        : <Text style={[styles.label, variant === 'outline' && styles.labelOutline]}>{label}</Text>
      }
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical:   14,
    paddingHorizontal: 20,
    borderRadius:      RADIUS.sm,
    alignItems:        'center',
    justifyContent:    'center',
  },
  primary: { backgroundColor: COLORS.primary },
  success: { backgroundColor: COLORS.success },
  danger:  { backgroundColor: COLORS.danger },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  disabled: { opacity: 0.5 },
  label: {
    color:      COLORS.white,
    fontSize:   FONT.md,
    fontWeight: '700',
  },
  labelOutline: { color: COLORS.primary },
});
