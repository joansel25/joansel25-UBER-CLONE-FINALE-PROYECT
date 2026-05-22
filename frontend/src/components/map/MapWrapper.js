import React from 'react';
import MapView, { PROVIDER_GOOGLE } from 'react-native-maps';
import { StyleSheet } from 'react-native';

// Placeholder — populated in Fase 3 with markers, polylines and driver tracking
export default function MapWrapper({ region, children, style, ...props }) {
  return (
    <MapView
      provider={PROVIDER_GOOGLE}
      style={[styles.map, style]}
      region={region}
      showsUserLocation
      showsMyLocationButton
      {...props}
    >
      {children}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
});
