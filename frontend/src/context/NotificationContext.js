import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { Animated, StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { FONT, RADIUS, SPACING } from '../constants/theme';

const DURATION_MS = 4000;
const ANIM_MS     = 300;

const TYPE_CONFIG = {
  success:  { bg: '#1B5E20', icon: 'checkmark-circle',     iconColor: '#69F0AE' },
  info:     { bg: '#0D47A1', icon: 'information-circle',    iconColor: '#82B1FF' },
  warning:  { bg: '#E65100', icon: 'warning',               iconColor: '#FFD740' },
  error:    { bg: '#B71C1C', icon: 'close-circle',          iconColor: '#FF5252' },
  trip:     { bg: '#1565C0', icon: 'car-sport',             iconColor: '#82B1FF' },
};

const NotificationContext = createContext(null);

function NotificationBannerView({ items, onDismiss }) {
  return (
    <View style={styles.bannerContainer} pointerEvents="box-none">
      {items.map(item => (
        <BannerItem key={item.id} item={item} onDismiss={onDismiss} />
      ))}
    </View>
  );
}

function BannerItem({ item, onDismiss }) {
  const translateY = useRef(new Animated.Value(-80)).current;
  const opacity    = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true, tension: 80, friction: 8 }),
      Animated.timing(opacity, { toValue: 1, duration: ANIM_MS, useNativeDriver: true }),
    ]).start();

    const timer = setTimeout(() => dismiss(), DURATION_MS);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dismiss() {
    Animated.parallel([
      Animated.timing(translateY, { toValue: -80, duration: ANIM_MS, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: ANIM_MS, useNativeDriver: true }),
    ]).start(() => onDismiss(item.id));
  }

  const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.info;

  return (
    <Animated.View style={[styles.banner, { backgroundColor: cfg.bg, opacity, transform: [{ translateY }] }]}>
      <Icon name={cfg.icon} size={22} color={cfg.iconColor} />
      <View style={styles.textBlock}>
        {item.title ? <Text style={styles.bannerTitle}>{item.title}</Text> : null}
        <Text style={styles.bannerMessage} numberOfLines={2}>{item.message}</Text>
      </View>
      <TouchableOpacity onPress={dismiss} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Icon name="close" size={18} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>
    </Animated.View>
  );
}

let _idCounter = 0;

export function NotificationProvider({ children }) {
  const [items, setItems] = useState([]);

  const dismiss = useCallback((id) => {
    setItems(prev => prev.filter(n => n.id !== id));
  }, []);

  const notify = useCallback(({ type = 'info', title, message }) => {
    const id = `notif_${++_idCounter}`;
    setItems(prev => [...prev.slice(-2), { id, type, title, message }]);
  }, []);

  // Convenience helpers for the most common trip events
  const notifyTripAccepted  = useCallback((driverName) =>
    notify({ type: 'trip',    title: '¡Conductor en camino!', message: `${driverName} aceptó tu viaje` }), [notify]);
  const notifyTripStarted   = useCallback(() =>
    notify({ type: 'trip',    title: 'Viaje iniciado',        message: 'Ya vas en camino a tu destino' }), [notify]);
  const notifyTripProgress  = useCallback((msg) =>
    notify({ type: 'info',    title: 'En ruta',               message: msg }), [notify]);
  const notifyTripCompleted = useCallback(() =>
    notify({ type: 'success', title: '¡Llegaste!',            message: 'Tu viaje ha sido completado' }), [notify]);
  const notifyPaymentDone   = useCallback((amount) =>
    notify({ type: 'success', title: 'Pago procesado',        message: `Se cobró ${amount} correctamente` }), [notify]);
  const notifyTripCancelled = useCallback(() =>
    notify({ type: 'warning', title: 'Viaje cancelado',       message: 'El viaje fue cancelado' }), [notify]);

  return (
    <NotificationContext.Provider value={{
      notify,
      notifyTripAccepted,
      notifyTripStarted,
      notifyTripProgress,
      notifyTripCompleted,
      notifyPaymentDone,
      notifyTripCancelled,
    }}>
      {children}
      <NotificationBannerView items={items} onDismiss={dismiss} />
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used inside NotificationProvider');
  return ctx;
}

const styles = StyleSheet.create({
  bannerContainer: {
    position: 'absolute', top: 0, left: 0, right: 0,
    zIndex: 9999, gap: 6, paddingTop: 48, paddingHorizontal: SPACING.sm,
  },
  banner: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: RADIUS.md, paddingVertical: 12, paddingHorizontal: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 10,
  },
  textBlock:     { flex: 1 },
  bannerTitle:   { fontSize: FONT.sm, fontWeight: '800', color: '#fff', marginBottom: 2 },
  bannerMessage: { fontSize: 12, color: 'rgba(255,255,255,0.9)' },
});
