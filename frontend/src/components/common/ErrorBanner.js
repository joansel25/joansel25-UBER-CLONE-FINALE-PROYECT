import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';

const ICONS = {
  error:   { name: 'alert-circle',       bg: '#FFF0F0', border: '#FF3B30', text: '#C0392B', icon: '#FF3B30' },
  warning: { name: 'warning',            bg: '#FFF8E1', border: '#FF9500', text: '#B7700D', icon: '#FF9500' },
  success: { name: 'checkmark-circle',   bg: '#F0FFF4', border: '#34C759', text: '#1E7E34', icon: '#34C759' },
  info:    { name: 'information-circle', bg: '#E3F2FD', border: '#007AFF', text: '#0056B3', icon: '#007AFF' },
};

export default function ErrorBanner({ message, type = 'error', onDismiss }) {
  const slideAnim = useRef(new Animated.Value(-80)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  const theme = ICONS[type] ?? ICONS.error;

  useEffect(() => {
    if (message) {
      Animated.parallel([
        Animated.spring(slideAnim,  { toValue: 0,   useNativeDriver: true, speed: 14 }),
        Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim,   { toValue: -80, duration: 200, useNativeDriver: true }),
        Animated.timing(opacityAnim, { toValue: 0,   duration: 150, useNativeDriver: true }),
      ]).start();
    }
  }, [message]);

  if (!message) return null;

  return (
    <Animated.View
      style={[
        styles.banner,
        { backgroundColor: theme.bg, borderColor: theme.border },
        { transform: [{ translateY: slideAnim }], opacity: opacityAnim },
      ]}
    >
      <Icon name={theme.name} size={20} color={theme.icon} style={styles.icon} />
      <Text style={[styles.text, { color: theme.text }]} numberOfLines={3}>
        {message}
      </Text>
      {onDismiss && (
        <TouchableOpacity onPress={onDismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Icon name="close" size={18} color={theme.icon} />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    gap: 10,
  },
  icon: { flexShrink: 0 },
  text: { flex: 1, fontSize: 13, fontWeight: '500', lineHeight: 18 },
});
