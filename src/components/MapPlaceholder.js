import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const MapPlaceholder = ({ style }) => {
  return (
    <View style={[styles.container, style]}>
      <Text style={styles.text}>Mapa no disponible</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#e0e0e0',
  },
  text: {
    color: '#757575',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MapPlaceholder;
