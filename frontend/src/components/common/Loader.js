import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { COLORS } from '../../constants/theme';

export default function Loader({ fullscreen = false, color = COLORS.primary }) {
  return (
    <View style={[styles.container, fullscreen && styles.fullscreen]}>
      <ActivityIndicator size="large" color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  container:  { alignItems: 'center', justifyContent: 'center', padding: 20 },
  fullscreen: { flex: 1, backgroundColor: COLORS.white },
});
