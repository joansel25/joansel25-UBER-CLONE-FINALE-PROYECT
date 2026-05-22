import React from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import { COLORS, RADIUS, FONT, SPACING } from '../../constants/theme';

export default function Input({
  label,
  error,
  hint,
  style,
  inputStyle,
  ...props
}) {
  return (
    <View style={[styles.wrapper, style]}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[styles.input, error && styles.inputError, inputStyle]}
        placeholderTextColor={COLORS.gray}
        {...props}
      />
      {error && <Text style={styles.error}>{error}</Text>}
      {hint && !error && <Text style={styles.hint}>{hint}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper:    { marginBottom: SPACING.sm + 8 },
  label: {
    fontSize:    FONT.base,
    fontWeight:  '600',
    color:       COLORS.dark,
    marginBottom: 8,
  },
  input: {
    borderWidth:       1,
    borderColor:       COLORS.border,
    borderRadius:      RADIUS.sm,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical:   SPACING.sm,
    fontSize:          FONT.base,
    color:             COLORS.black,
    backgroundColor:   COLORS.inputBg,
  },
  inputError: { borderColor: COLORS.danger },
  error: {
    fontSize:  FONT.sm,
    color:     COLORS.danger,
    marginTop: 4,
  },
  hint: {
    fontSize:   FONT.sm,
    color:      COLORS.gray,
    marginTop:  4,
    fontStyle:  'italic',
  },
});
